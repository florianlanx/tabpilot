import {
  groupAllTabs,
  ungroupAllTabs,
  closeGroupTabs,
  classifyNewTabs,
  autoGroupNewTab,
  expandAllGroups,
  collapseAllGroups,
  toggleGroupTitles,
  areGroupTitlesHidden,
  getGroupsPreview,
  invalidatePreviewCache,
  cacheAddTab,
  cacheRemoveTab,
  cacheUpdateTab,
  debouncedCacheRebuild,
  handleTabGroupUpdated,
  handleTabGroupRemoved,
} from './tab-manager'
import { searchTabs } from './searcher'
import { recordTabVisit, getHistoryEntries } from './storage'
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants'
import type { ExtensionMessage, TabInfo, ExtensionSettings, WindowGroupsInfo } from '../shared/types'

console.log('[TabPilot] Service worker started')

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TabPilot] Extension installed')
})

// --- Tab history tracking + cache updates ---
chrome.tabs.onCreated.addListener((tab) => {
  cacheAddTab(tab)
  if (tab.windowId !== undefined) debouncedCacheRebuild(tab.windowId)
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.title) {
    recordTabVisit(tab.url, tab.title, tab.favIconUrl)
    cacheUpdateTab(tab)
    autoGroupNewTab(tab).catch((err) =>
      console.error('[TabPilot] autoGroupNewTab failed:', err),
    )
  } else if (changeInfo.url) {
    cacheUpdateTab(tab)
  }
  if (tab.windowId !== undefined) debouncedCacheRebuild(tab.windowId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  cacheRemoveTab(tabId)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && tab.title) {
      recordTabVisit(tab.url, tab.title, tab.favIconUrl)
    }
  } catch {
    // Tab may have been removed
  }
})

// --- Smart group title: toggle title on collapse/expand ---
chrome.tabGroups.onUpdated.addListener((group) => {
  handleTabGroupUpdated(group)
})

chrome.tabGroups.onRemoved.addListener((group) => {
  handleTabGroupRemoved(group.id)
})

// --- Command handler (keyboard shortcut) ---
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-search') {
    await toggleSearchOverlay()
  }
})

async function toggleSearchOverlay() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url) return
    // Skip restricted URLs where content scripts can't run
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return

    const tabId = tab.id

    // Check if content script is already loaded
    let isLoaded = false
    try {
      const [checkResult] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => !!(window as unknown as Record<string, boolean>).__ATM_SEARCH_LOADED__,
      })
      isLoaded = !!checkResult?.result
    } catch {
      // scripting.executeScript failed — tab may not support it
    }

    // Inject content script if not loaded
    if (!isLoaded) {
      const manifest = chrome.runtime.getManifest()
      const contentScriptFiles = manifest.content_scripts?.[0]?.js || []
      if (contentScriptFiles.length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: contentScriptFiles,
        })
      }
    }

    // Toggle the overlay via executeScript
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const toggleFn = (window as unknown as Record<string, () => void>).__ATM_TOGGLE_SEARCH__
        if (toggleFn) toggleFn()
      },
    })
  } catch {
    // Tab doesn't support scripting (e.g. chrome:// pages)
  }
}

// --- Message handler ---
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      console.error('[TabPilot] Error:', err)
      sendResponse({ error: err.message })
    })
    return true
  },
)

/** Resolve window ID from message payload or last focused window (for popup context). */
async function resolveWindowId(payload: unknown): Promise<number> {
  const windowId = (payload as { windowId?: number })?.windowId
  if (windowId !== undefined && Number.isInteger(windowId)) return windowId
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] })
  return win.id ?? -1
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.action) {
    case 'GROUP_TABS': {
      const windowId = await resolveWindowId(message.payload)
      await groupAllTabs(windowId)
      return { ok: true }
    }

    case 'UNGROUP_ALL': {
      const windowId = await resolveWindowId(message.payload)
      await ungroupAllTabs(windowId)
      invalidatePreviewCache(windowId)
      return { ok: true }
    }

    case 'CLOSE_GROUP': {
      const tabIds = (message.payload as { tabIds: number[] })?.tabIds || []
      await closeGroupTabs(tabIds)
      return { ok: true }
    }

    case 'CLASSIFY_NEW_TABS': {
      const windowId = await resolveWindowId(message.payload)
      await classifyNewTabs(windowId)
      return { ok: true }
    }

    case 'EXPAND_ALL_GROUPS': {
      const windowId = await resolveWindowId(message.payload)
      await expandAllGroups(windowId)
      return { ok: true }
    }

    case 'COLLAPSE_ALL_GROUPS': {
      const windowId = await resolveWindowId(message.payload)
      await collapseAllGroups(windowId)
      return { ok: true }
    }

    case 'TOGGLE_GROUP_TITLES': {
      const windowId = await resolveWindowId(message.payload)
      const hidden = await toggleGroupTitles(windowId)
      return { ok: true, hidden }
    }

    case 'GET_GROUPS_PREVIEW': {
      const windowId = await resolveWindowId(message.payload)
      return await getGroupsPreview(windowId)
    }

    case 'REFRESH_GROUPS_PREVIEW': {
      const windowId = await resolveWindowId(message.payload)
      return await getGroupsPreview(windowId, true)
    }

    case 'GET_ALL_WINDOWS_PREVIEW': {
      const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
      const result: WindowGroupsInfo[] = await Promise.all(
        windows.map(async (win) => {
          const wid = win.id!
          const groups = await getGroupsPreview(wid)
          const tabs = await chrome.tabs.query({ windowId: wid })
          const hasGroups = tabs.some(
            (t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE,
          )
          return {
            windowId: wid,
            tabCount: tabs.length,
            focused: !!win.focused,
            groups,
            hasGroups,
            titlesHidden: areGroupTitlesHidden(wid),
          }
        }),
      )
      return result
    }

    case 'SEARCH_TABS': {
      const payload = message.payload as { query: string; windowId?: number } | undefined
      const query = payload?.query ?? ''
      const windowId = payload?.windowId
      const tabs = await (windowId !== undefined
        ? chrome.tabs.query({ windowId })
        : chrome.tabs.query({ currentWindow: true }))
      const openTabs: TabInfo[] = tabs
        .filter((t) => t.id !== undefined)
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
      const history = await getHistoryEntries()
      return searchTabs(query, openTabs, history)
    }

    case 'GET_SETTINGS': {
      const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
      return { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] }
    }

    case 'SAVE_SETTINGS': {
      const newSettings = message.payload as ExtensionSettings
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings })
      invalidatePreviewCache()
      return { ok: true }
    }

    case 'SWITCH_TAB': {
      const tabId = (message.payload as { tabId: number })?.tabId
      if (tabId) {
        await chrome.tabs.update(tabId, { active: true })
      }
      return { ok: true }
    }

    case 'OPEN_URL': {
      const url = (message.payload as { url: string })?.url
      if (url) {
        await chrome.tabs.create({ url })
      }
      return { ok: true }
    }

    case 'TOGGLE_SEARCH_OVERLAY': {
      await toggleSearchOverlay()
      return { ok: true }
    }

    default:
      return { error: 'Unknown action' }
  }
}
