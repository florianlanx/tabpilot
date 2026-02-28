import { classify, classifyTabs, groupTabsFreelyWithAI } from './classifier'
import type { FreeGroupResult } from './classifier'
import { GROUP_DEFINITIONS, STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants'
import { getMessage } from '../shared/i18n'
import { AIClient } from '../shared/ai-client'
import type { GroupCategory, GroupedTabs, TabInfo, ExtensionSettings, ChromeTabGroupColor } from '../shared/types'

// --- Cache state ---
const CACHE_DEBOUNCE_MS = 300
const TAB_RETRY_ATTEMPTS = 3
const TAB_RETRY_DELAY_MS = 200
const UNGROUPED_AI_GROUP_NAME = 'New Tabs'
/** Per-window preview cache. Key: windowId */
const previewCacheMap = new Map<number, GroupedTabs[]>()
/** Which windows have AI-generated groups (for cache restore behavior). */
const cacheIsAIGroupedMap = new Map<number, boolean>()

// --- Smart group title state ---
// Maps Chrome groupId → stored display title (used to enforce persistent titles)
const groupTitleMap = new Map<number, string>()
// Tracks groups currently being updated by us to prevent infinite loops
const updatingGroups = new Set<number>()
// Per-window: whether group titles are hidden in Chrome tab bar
const titlesHiddenMap = new Map<number, boolean>()

async function retryTabOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < TAB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable =
        err instanceof Error && err.message.includes('Tabs cannot be edited right now')
      if (!isRetryable || attempt === TAB_RETRY_ATTEMPTS - 1) throw err
      await new Promise((r) => setTimeout(r, TAB_RETRY_DELAY_MS * (attempt + 1)))
    }
  }
  throw new Error('retryTabOperation: unreachable')
}

async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const saved = (data[STORAGE_KEYS.SETTINGS] ?? {}) as Partial<ExtensionSettings>
  return { ...DEFAULT_SETTINGS, ...saved }
}

function tabsFromChrome(
  chromeTabs: chrome.tabs.Tab[],
  tabIds: number[],
): TabInfo[] {
  return chromeTabs
    .filter((t) => t.id !== undefined && tabIds.includes(t.id))
    .map((t) => ({
      id: t.id!,
      url: t.url || '',
      title: t.title || '',
      favIconUrl: t.favIconUrl,
      windowId: t.windowId,
      index: t.index,
      active: t.active,
      pinned: t.pinned,
    }))
}

function chromeTabToTabInfo(tab: chrome.tabs.Tab): TabInfo | null {
  if (tab.id === undefined) return null
  return {
    id: tab.id,
    url: tab.url || '',
    title: tab.title || '',
    favIconUrl: tab.favIconUrl,
    windowId: tab.windowId,
    index: tab.index,
    active: tab.active,
    pinned: tab.pinned,
  }
}

function sortGroups(groups: GroupedTabs[]): GroupedTabs[] {
  return groups.sort((a, b) => {
    if (a.category === 'other') return 1
    if (b.category === 'other') return -1
    return b.tabs.length - a.tabs.length
  })
}

function freeGroupsToGroupedTabs(
  freeGroups: FreeGroupResult[],
  chromeTabs: chrome.tabs.Tab[],
): GroupedTabs[] {
  return freeGroups
    .map((g) => ({
      category: 'other' as GroupCategory,
      tabs: tabsFromChrome(chromeTabs, g.tabIds),
      groupName: g.name,
      groupColor: g.color,
    }))
    .filter((g) => g.tabs.length > 0)
}

function ruleGroupsToGroupedTabs(
  groups: Map<GroupCategory, number[]>,
  chromeTabs: chrome.tabs.Tab[],
): GroupedTabs[] {
  const result: GroupedTabs[] = []
  for (const [category, tabIds] of groups) {
    const categoryTabs = tabsFromChrome(chromeTabs, tabIds)
    if (categoryTabs.length > 0) {
      result.push({ category, tabs: categoryTabs })
    }
  }
  return result
}

// --- Cache management ---

export function invalidatePreviewCache(windowId?: number): void {
  if (windowId !== undefined) {
    previewCacheMap.delete(windowId)
    cacheIsAIGroupedMap.delete(windowId)
  } else {
    previewCacheMap.clear()
    cacheIsAIGroupedMap.clear()
  }
}

export function cacheAddTab(tab: chrome.tabs.Tab): void {
  const windowId = tab.windowId
  let previewCache = previewCacheMap.get(windowId)
  if (!previewCache) return

  const tabInfo = chromeTabToTabInfo(tab)
  if (!tabInfo) return

  const cacheIsAIGrouped = cacheIsAIGroupedMap.get(windowId) ?? false
  if (cacheIsAIGrouped) {
    // When AI-grouped, put new tabs in an "ungrouped" bucket instead of
    // running rule engine which would create mismatched rule-engine groups.
    const ungrouped = previewCache.find((g) => g.groupName === UNGROUPED_AI_GROUP_NAME)
    if (ungrouped) {
      ungrouped.tabs.push(tabInfo)
    } else {
      previewCache.push({
        category: 'other' as GroupCategory,
        tabs: [tabInfo],
        groupName: UNGROUPED_AI_GROUP_NAME,
        groupColor: 'grey',
      })
    }
    return
  }

  const result = classify(tab.url, tab.title)
  const category = result.category

  const group = previewCache.find((g) => g.category === category && !g.groupName)
  if (group) {
    group.tabs.push(tabInfo)
  } else {
    previewCache.push({ category, tabs: [tabInfo] })
  }
  sortGroups(previewCache)
}

export function cacheRemoveTab(tabId: number): void {
  for (const [windowId, previewCache] of previewCacheMap) {
    let found = false
    for (let i = previewCache.length - 1; i >= 0; i--) {
      const group = previewCache[i]
      const before = group.tabs.length
      group.tabs = group.tabs.filter((t) => t.id !== tabId)
      if (group.tabs.length !== before) found = true
      if (group.tabs.length === 0) {
        previewCache.splice(i, 1)
      }
    }
    if (previewCache.length === 0) {
      previewCacheMap.delete(windowId)
    }
    if (found) break
  }
}

export function cacheUpdateTab(tab: chrome.tabs.Tab): void {
  const windowId = tab.windowId
  const previewCache = previewCacheMap.get(windowId)
  if (!previewCache || tab.id === undefined) return

  const cacheIsAIGrouped = cacheIsAIGroupedMap.get(windowId) ?? false
  if (cacheIsAIGrouped) {
    // When AI-grouped, update tab metadata in-place without re-classifying.
    // This preserves the AI group assignment.
    const tabInfo = chromeTabToTabInfo(tab)
    if (!tabInfo) return

    for (const group of previewCache) {
      const idx = group.tabs.findIndex((t) => t.id === tab.id)
      if (idx !== -1) {
        group.tabs[idx] = tabInfo
        return
      }
    }
    // Tab not found in any group — treat as new tab
    cacheAddTab(tab)
    return
  }

  cacheRemoveTab(tab.id)

  const tabInfo = chromeTabToTabInfo(tab)
  if (!tabInfo) return

  const result = classify(tab.url, tab.title)
  const category = result.category

  const group = previewCache.find((g) => g.category === category && !g.groupName)
  if (group) {
    group.tabs.push(tabInfo)
  } else {
    previewCache.push({ category, tabs: [tabInfo] })
  }
  sortGroups(previewCache)
}

const RESTRICTED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'edge://']

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true
  return RESTRICTED_URL_PREFIXES.some((p) => url.startsWith(p))
}

/**
 * When a tab finishes loading in an AI-grouped window and is not yet in any
 * Chrome group, automatically add it to the "New Tabs" Chrome group.
 */
export async function autoGroupNewTab(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || tab.pinned || isRestrictedUrl(tab.url)) return
  const windowId = tab.windowId
  if (!(cacheIsAIGroupedMap.get(windowId) ?? false)) return
  if (tab.groupId !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) return

  const hideTitles = titlesHiddenMap.get(windowId) ?? false

  // Find existing "New Tabs" Chrome group in this window
  const existingGroups = await chrome.tabGroups.query({ windowId })
  const newTabsGroup = existingGroups.find(
    (g) => g.title === UNGROUPED_AI_GROUP_NAME || groupTitleMap.get(g.id) === UNGROUPED_AI_GROUP_NAME,
  )

  if (newTabsGroup) {
    await retryTabOperation(() =>
      chrome.tabs.group({ tabIds: [tab.id!], groupId: newTabsGroup.id }),
    )
  } else {
    const groupId = await retryTabOperation(() =>
      chrome.tabs.group({ tabIds: [tab.id!] }),
    )
    groupTitleMap.set(groupId, UNGROUPED_AI_GROUP_NAME)
    updatingGroups.add(groupId)
    try {
      await retryTabOperation(() =>
        chrome.tabGroups.update(groupId, {
          title: hideTitles ? '' : UNGROUPED_AI_GROUP_NAME,
          color: 'grey',
        }),
      )
    } finally {
      updatingGroups.delete(groupId)
    }
  }

  await updateNewTabsBadge(windowId)
}

/**
 * Update the extension badge to show how many tabs are in the "New Tabs" group.
 */
export async function updateNewTabsBadge(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const groups = await chrome.tabGroups.query({ windowId })
  const newTabsGroup = groups.find(
    (g) => g.title === UNGROUPED_AI_GROUP_NAME || groupTitleMap.get(g.id) === UNGROUPED_AI_GROUP_NAME,
  )

  let count = 0
  if (newTabsGroup) {
    count = tabs.filter((t) => t.groupId === newTabsGroup.id).length
  }

  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#6B7280' })
}

async function rebuildCache(windowId: number): Promise<void> {
  const previewCache = previewCacheMap.get(windowId)
  const cacheIsAIGrouped = cacheIsAIGroupedMap.get(windowId) ?? false

  if (cacheIsAIGrouped && previewCache && previewCache.length > 0) {
    const tabs = await chrome.tabs.query({ windowId })
    const tabMap = new Map(tabs.filter((t) => t.id !== undefined).map((t) => [t.id!, t]))

    for (const group of previewCache) {
      group.tabs = group.tabs
        .map((t) => {
          const fresh = tabMap.get(t.id)
          return fresh ? (chromeTabToTabInfo(fresh) ?? t) : null
        })
        .filter((t): t is TabInfo => t !== null)
    }
    const filtered = previewCache.filter((g) => g.tabs.length > 0)
    previewCacheMap.set(windowId, filtered)
    return
  }

  const tabs = await chrome.tabs.query({ windowId })

  // Try to restore from Chrome tab groups (handles service worker restart)
  const fromChrome = await buildGroupsFromChrome(tabs)
  if (fromChrome) {
    previewCacheMap.set(windowId, sortGroups(fromChrome))
    cacheIsAIGroupedMap.set(windowId, fromChrome.some((g) => !!g.groupName))
  } else {
    previewCacheMap.set(windowId, sortGroups(ruleGroupsToGroupedTabs(classifyTabs(tabs), tabs)))
    cacheIsAIGroupedMap.set(windowId, false)
  }
}

const rebuildTimeoutsByWindow = new Map<number, ReturnType<typeof setTimeout>>()
export function debouncedCacheRebuild(windowId: number): void {
  const existing = rebuildTimeoutsByWindow.get(windowId)
  if (existing) clearTimeout(existing)
  rebuildTimeoutsByWindow.set(
    windowId,
    setTimeout(() => {
      rebuildTimeoutsByWindow.delete(windowId)
      rebuildCache(windowId)
    }, CACHE_DEBOUNCE_MS),
  )
}

// --- Restore groups from Chrome tab groups ---

/**
 * Read the actual Chrome tab group state and build GroupedTabs[] from it.
 * Returns null if no tabs are currently grouped in Chrome.
 */
async function buildGroupsFromChrome(tabs: chrome.tabs.Tab[]): Promise<GroupedTabs[] | null> {
  const groupedTabs = tabs.filter((t) => t.groupId !== undefined && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
  if (groupedTabs.length === 0) return null

  // Collect unique group IDs
  const groupIds = [...new Set(groupedTabs.map((t) => t.groupId))]

  // Query Chrome for group metadata (title, color)
  const chromeGroups = new Map<number, chrome.tabGroups.TabGroup>()
  for (const gid of groupIds) {
    try {
      const group = await chrome.tabGroups.get(gid)
      chromeGroups.set(gid, group)
    } catch {
      // Group may have been removed
    }
  }

  if (chromeGroups.size === 0) return null

  // Build GroupedTabs from Chrome state
  const result: GroupedTabs[] = []
  for (const [gid, chromeGroup] of chromeGroups) {
    const memberTabs = tabs.filter((t) => t.groupId === gid)
    const tabInfos = memberTabs
      .map((t) => chromeTabToTabInfo(t))
      .filter((t): t is TabInfo => t !== null)

    if (tabInfos.length === 0) continue

    result.push({
      category: 'other' as GroupCategory,
      tabs: tabInfos,
      groupName: chromeGroup.title || groupTitleMap.get(gid) || undefined,
      groupColor: (chromeGroup.color as ChromeTabGroupColor) || 'grey',
    })
  }

  // Add ungrouped tabs as a separate group
  const ungroupedTabs = tabs.filter(
    (t) => t.groupId === undefined || t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE,
  )
  const ungroupedInfos = ungroupedTabs
    .map((t) => chromeTabToTabInfo(t))
    .filter((t): t is TabInfo => t !== null)
  if (ungroupedInfos.length > 0) {
    result.push({
      category: 'other' as GroupCategory,
      tabs: ungroupedInfos,
    })
  }

  return result
}

// --- Public API ---

/**
 * Get all tabs in the given window, classify them, and return a preview.
 * Returns cached result when available. Pass forceRefresh=true to rebuild
 * (uses AI if enabled, otherwise rule engine).
 *
 * When cache is empty (e.g. service worker restarted), first checks if Chrome
 * already has tab groups and restores from those — this preserves AI grouping
 * results across service worker restarts.
 */
export async function getGroupsPreview(windowId: number, forceRefresh = false): Promise<GroupedTabs[]> {
  const cached = previewCacheMap.get(windowId)
  if (cached && !forceRefresh) return cached

  const tabs = await chrome.tabs.query({ windowId })
  const settings = await getSettings()

  let result: GroupedTabs[]

  if (forceRefresh && settings.ai.enabled && settings.ai.apiKey) {
    try {
      const freeGroups = await groupTabsFreelyWithAI(tabs, settings.ai)
      result = freeGroupsToGroupedTabs(freeGroups, tabs)
      cacheIsAIGroupedMap.set(windowId, true)
    } catch (err) {
      console.error('[TabPilot] AI free grouping failed, falling back to rules:', err)
      result = ruleGroupsToGroupedTabs(classifyTabs(tabs), tabs)
      cacheIsAIGroupedMap.set(windowId, false)
    }
  } else {
    const fromChrome = await buildGroupsFromChrome(tabs)
    if (fromChrome) {
      result = fromChrome
      cacheIsAIGroupedMap.set(windowId, fromChrome.some((g) => !!g.groupName))
    } else {
      result = ruleGroupsToGroupedTabs(classifyTabs(tabs), tabs)
      cacheIsAIGroupedMap.set(windowId, false)
    }
  }

  const sorted = sortGroups(result)
  previewCacheMap.set(windowId, sorted)
  return sorted
}

/**
 * Group all tabs in the given window using Chrome Tab Groups API.
 */
export async function groupAllTabs(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId, windowType: 'normal' })
  const unpinnedTabs = tabs.filter((t) => !t.pinned)

  const settings = await getSettings()

  await ungroupAllTabs(windowId)

  const hideTitles = titlesHiddenMap.get(windowId) ?? false

  if (settings.ai.enabled && settings.ai.apiKey) {
    try {
      const freeGroups = await groupTabsFreelyWithAI(unpinnedTabs, settings.ai)
      for (const group of freeGroups) {
        if (group.tabIds.length === 0) continue
        const groupId = await retryTabOperation(() =>
          chrome.tabs.group({ tabIds: group.tabIds as [number, ...number[]] }),
        )
        groupTitleMap.set(groupId, group.name)
        await retryTabOperation(() =>
          chrome.tabGroups.update(groupId, {
            title: hideTitles ? '' : group.name,
            color: group.color,
          }),
        )
      }
      previewCacheMap.set(windowId, sortGroups(freeGroupsToGroupedTabs(freeGroups, tabs)))
      cacheIsAIGroupedMap.set(windowId, true)
      await updateNewTabsBadge(windowId)
      return
    } catch (err) {
      console.error('[TabPilot] AI free grouping failed, falling back to rules:', err)
      // Fall through to rule engine
    }
  }

  const groups = classifyTabs(unpinnedTabs)
  for (const [category, tabIds] of groups) {
    if (tabIds.length === 0) continue

    const def = GROUP_DEFINITIONS[category]
    const title = getMessage(def.labelKey)
    const shouldCollapse = category === 'other'
    const groupId = await retryTabOperation(() =>
      chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] }),
    )
    groupTitleMap.set(groupId, title)

    updatingGroups.add(groupId)
    await retryTabOperation(() =>
      chrome.tabGroups.update(groupId, {
        title: hideTitles ? '' : title,
        color: def.color,
        collapsed: shouldCollapse,
      }),
    )
    updatingGroups.delete(groupId)
  }
  previewCacheMap.set(windowId, sortGroups(ruleGroupsToGroupedTabs(groups, tabs)))
  cacheIsAIGroupedMap.set(windowId, false)
  await updateNewTabsBadge(windowId)
}

/**
 * Classify new tabs (from the "New Tabs" group) into existing AI groups.
 * Uses AI to decide which group each tab belongs to, then moves them.
 */
export async function classifyNewTabs(windowId: number): Promise<void> {
  const settings = await getSettings()
  if (!settings.ai.enabled || !settings.ai.apiKey) {
    throw new Error('AI is not configured')
  }

  const allTabs = await chrome.tabs.query({ windowId })
  const allGroups = await chrome.tabGroups.query({ windowId })

  // Find the "New Tabs" group
  const newTabsGroup = allGroups.find(
    (g) => g.title === UNGROUPED_AI_GROUP_NAME || groupTitleMap.get(g.id) === UNGROUPED_AI_GROUP_NAME,
  )
  if (!newTabsGroup) return

  const newTabs = allTabs.filter((t) => t.groupId === newTabsGroup.id && t.id !== undefined)
  if (newTabs.length === 0) return

  // Build existing group name → groupId mapping (exclude "New Tabs")
  const groupNameToId = new Map<string, number>()
  for (const g of allGroups) {
    if (g.id === newTabsGroup.id) continue
    const name = groupTitleMap.get(g.id) || g.title
    if (name) groupNameToId.set(name, g.id)
  }

  const existingGroupNames = [...groupNameToId.keys()]
  if (existingGroupNames.length === 0) return

  const client = new AIClient(settings.ai)
  const classifications = await client.classifyNewTabsIntoGroups(
    newTabs.map((t) => ({ url: t.url || '', title: t.title || '' })),
    existingGroupNames,
  )

  const hideTitles = titlesHiddenMap.get(windowId) ?? false

  for (const item of classifications) {
    const tab = newTabs[item.index]
    if (!tab?.id) continue

    if (item.group !== 'NEW' && groupNameToId.has(item.group)) {
      const targetGroupId = groupNameToId.get(item.group)!
      await retryTabOperation(() =>
        chrome.tabs.group({ tabIds: [tab.id!], groupId: targetGroupId }),
      )
    } else {
      const name = item.newGroupName || 'Other'
      const color = (item.newGroupColor as ChromeTabGroupColor) || 'grey'
      // Check if we already created this new group in this batch
      if (groupNameToId.has(name)) {
        const targetGroupId = groupNameToId.get(name)!
        await retryTabOperation(() =>
          chrome.tabs.group({ tabIds: [tab.id!], groupId: targetGroupId }),
        )
      } else {
        const groupId = await retryTabOperation(() =>
          chrome.tabs.group({ tabIds: [tab.id!] }),
        )
        groupTitleMap.set(groupId, name)
        updatingGroups.add(groupId)
        try {
          await retryTabOperation(() =>
            chrome.tabGroups.update(groupId, {
              title: hideTitles ? '' : name,
              color,
            }),
          )
        } finally {
          updatingGroups.delete(groupId)
        }
        groupNameToId.set(name, groupId)
      }
    }
  }

  // Rebuild preview cache and clear badge
  invalidatePreviewCache(windowId)
  await getGroupsPreview(windowId)
  await updateNewTabsBadge(windowId)
}

/**
 * Close all tabs in a group by their IDs and remove them from cache.
 */
export async function closeGroupTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return
  await chrome.tabs.remove(tabIds)
  for (const id of tabIds) {
    cacheRemoveTab(id)
  }
}

/**
 * Set collapsed state on all Chrome tab groups in the given window.
 */
async function setAllGroupsCollapsed(windowId: number, collapsed: boolean): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const groupIds = [
    ...new Set(
      tabs
        .filter((t) => t.groupId !== undefined && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
        .map((t) => t.groupId),
    ),
  ]
  for (const groupId of groupIds) {
    updatingGroups.add(groupId)
    try {
      await retryTabOperation(() =>
        chrome.tabGroups.update(groupId, { collapsed }),
      )
    } catch (err) {
      console.error(`[TabPilot] Failed to update group ${groupId} collapsed=${collapsed}:`, err)
    } finally {
      updatingGroups.delete(groupId)
    }
  }
}

export async function expandAllGroups(windowId: number): Promise<void> {
  await setAllGroupsCollapsed(windowId, false)
}

export async function collapseAllGroups(windowId: number): Promise<void> {
  await setAllGroupsCollapsed(windowId, true)
}

export function areGroupTitlesHidden(windowId: number): boolean {
  return titlesHiddenMap.get(windowId) ?? false
}

/**
 * Toggle group title visibility in the Chrome tab bar.
 * When hidden, group labels shrink to minimal colored dots.
 * Returns the new hidden state.
 */
export async function toggleGroupTitles(windowId: number): Promise<boolean> {
  const isHidden = titlesHiddenMap.get(windowId) ?? false
  const tabs = await chrome.tabs.query({ windowId })
  const groupIds = [
    ...new Set(
      tabs
        .filter((t) => t.groupId !== undefined && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
        .map((t) => t.groupId),
    ),
  ]

  for (const groupId of groupIds) {
    if (isHidden) {
      const savedTitle = groupTitleMap.get(groupId)
      if (!savedTitle) continue
      updatingGroups.add(groupId)
      try {
        await retryTabOperation(() =>
          chrome.tabGroups.update(groupId, { title: savedTitle }),
        )
      } catch (err) {
        console.error(`[TabPilot] Failed to restore title for group ${groupId}:`, err)
      } finally {
        updatingGroups.delete(groupId)
      }
    } else {
      if (!groupTitleMap.has(groupId)) {
        try {
          const g = await chrome.tabGroups.get(groupId)
          if (g.title) groupTitleMap.set(groupId, g.title)
        } catch {
          // Group may have been removed
        }
      }
      updatingGroups.add(groupId)
      try {
        await retryTabOperation(() =>
          chrome.tabGroups.update(groupId, { title: '' }),
        )
      } catch (err) {
        console.error(`[TabPilot] Failed to hide title for group ${groupId}:`, err)
      } finally {
        updatingGroups.delete(groupId)
      }
    }
  }

  const newState = !isHidden
  titlesHiddenMap.set(windowId, newState)
  return newState
}

/**
 * Ungroup all tabs in the given window.
 */
export async function ungroupAllTabs(windowId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ windowId })
  const groupedTabs = tabs.filter((t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)

  for (const tab of groupedTabs) {
    if (tab.id) {
      await retryTabOperation(() => chrome.tabs.ungroup(tab.id!))
    }
  }
  await chrome.action.setBadgeText({ text: '' })
}

/**
 * Handle Chrome tab group update events for smart title toggling.
 * Always keep the full group title visible regardless of collapse state,
 * so the title is shown in the bookmarks bar on the new tab page.
 */
export async function handleTabGroupUpdated(group: chrome.tabGroups.TabGroup): Promise<void> {
  if (updatingGroups.has(group.id)) return

  const hidden = titlesHiddenMap.get(group.windowId) ?? false
  if (hidden) {
    if (group.title !== '') {
      updatingGroups.add(group.id)
      try {
        await chrome.tabGroups.update(group.id, { title: '' })
      } catch {
        // Group may have been removed
      } finally {
        updatingGroups.delete(group.id)
      }
    }
    return
  }

  const settings = await getSettings()
  if (!settings.smartGroupTitle) return

  const savedTitle = groupTitleMap.get(group.id)
  if (!savedTitle) return

  if (group.title === savedTitle) return

  updatingGroups.add(group.id)
  try {
    await chrome.tabGroups.update(group.id, { title: savedTitle })
  } catch {
    // Group may have been removed
  } finally {
    updatingGroups.delete(group.id)
  }
}

/**
 * Clean up stored title mapping when a group is removed.
 */
export function handleTabGroupRemoved(groupId: number): void {
  groupTitleMap.delete(groupId)
  updatingGroups.delete(groupId)
}
