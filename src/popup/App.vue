<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { getMessage } from '../shared/i18n'
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants'
import type { ExtensionSettings, GroupIndicatorStyle, ThemeMode, WindowGroupsInfo } from '../shared/types'
import GroupList from './components/GroupList.vue'
import SettingsView from './components/SettingsView.vue'

const currentView = ref<'main' | 'settings'>('main')
const allWindows = ref<WindowGroupsInfo[]>([])
const loading = ref(true)
const groupingWindowId = ref<number | null>(null)
const classifyingWindowId = ref<number | null>(null)
const currentWindowId = ref<number | null>(null)
const indicatorStyle = ref<GroupIndicatorStyle>(DEFAULT_SETTINGS.groupIndicatorStyle)

// ─── Theme System ───

const themeMode = ref<ThemeMode>('system')
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && mediaQuery.matches)
  document.documentElement.classList.toggle('dark', isDark)
}

function toggleTheme() {
  const currentlyDark = document.documentElement.classList.contains('dark')
  themeMode.value = currentlyDark ? 'light' : 'dark'
  applyTheme(themeMode.value)
  localStorage.setItem('atm_theme', themeMode.value)
  chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then((data) => {
    const s = (data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined) || { ...DEFAULT_SETTINGS }
    ;(s as ExtensionSettings).theme = themeMode.value
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: s })
  })
}

function onSystemThemeChange() {
  if (themeMode.value === 'system') applyTheme('system')
}

watch(themeMode, (mode) => applyTheme(mode))

// ─── Data Loading ───

onMounted(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  if (stored?.groupIndicatorStyle) {
    indicatorStyle.value = stored.groupIndicatorStyle
  }
  if (stored?.theme) {
    themeMode.value = stored.theme
  } else {
    const saved = localStorage.getItem('atm_theme') as ThemeMode | null
    if (saved) themeMode.value = saved
  }
  applyTheme(themeMode.value)
  mediaQuery.addEventListener('change', onSystemThemeChange)

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentWindowId.value = activeTab?.windowId ?? null
  await loadAllPreviews()
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', onSystemThemeChange)
})

const totalTabs = computed(() =>
  allWindows.value.reduce((sum, w) => sum + w.tabCount, 0),
)

const isDarkActive = computed(() => document.documentElement.classList.contains('dark'))

async function loadAllPreviews() {
  loading.value = true
  try {
    const result = await chrome.runtime.sendMessage({ action: 'GET_ALL_WINDOWS_PREVIEW' })
    if (Array.isArray(result)) {
      const sorted = (result as WindowGroupsInfo[]).sort((a, b) => {
        if (a.windowId === currentWindowId.value) return -1
        if (b.windowId === currentWindowId.value) return 1
        return 0
      })
      allWindows.value = sorted
      const titlesState: Record<number, boolean> = {}
      for (const w of sorted) {
        titlesState[w.windowId] = w.titlesHidden
      }
      windowTitlesHidden.value = titlesState
    }
  } catch (err) {
    console.error('Failed to load preview:', err)
  } finally {
    loading.value = false
  }
}

function windowLabel(w: WindowGroupsInfo, idx: number): string {
  const isCurrent = w.windowId === currentWindowId.value
  const label = isCurrent ? getMessage('currentWindow') : `${getMessage('windowLabel')} ${idx + 1}`
  return `${label}`
}

function newTabsCount(w: WindowGroupsInfo): number {
  const group = w.groups.find((g) => g.groupName === 'New Tabs')
  return group ? group.tabs.length : 0
}

async function handleClassifyNew(windowId: number) {
  classifyingWindowId.value = windowId
  try {
    await chrome.runtime.sendMessage({ action: 'CLASSIFY_NEW_TABS', payload: { windowId } })
    await loadAllPreviews()
  } finally {
    classifyingWindowId.value = null
  }
}

async function handleGroup(windowId: number) {
  groupingWindowId.value = windowId
  try {
    await chrome.runtime.sendMessage({ action: 'GROUP_TABS', payload: { windowId } })
    await loadAllPreviews()
  } finally {
    groupingWindowId.value = null
  }
}

async function handleUngroup(windowId: number) {
  await chrome.runtime.sendMessage({ action: 'UNGROUP_ALL', payload: { windowId } })
  await loadAllPreviews()
}

async function handleSettingsBack() {
  currentView.value = 'main'
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  if (stored?.groupIndicatorStyle) {
    indicatorStyle.value = stored.groupIndicatorStyle
  }
  if (stored?.theme) {
    themeMode.value = stored.theme
    applyTheme(themeMode.value)
  }
}

const expandTriggers = ref<Record<number, number>>({})
const collapseTriggers = ref<Record<number, number>>({})
const windowCollapsedState = ref<Record<number, boolean>>({})

function isWindowCollapsed(windowId: number): boolean {
  return windowCollapsedState.value[windowId] ?? (indicatorStyle.value === 'header')
}

async function handleToggleAllGroups(windowId: number) {
  const collapsed = isWindowCollapsed(windowId)
  if (collapsed) {
    expandTriggers.value = { ...expandTriggers.value, [windowId]: (expandTriggers.value[windowId] || 0) + 1 }
    await chrome.runtime.sendMessage({ action: 'EXPAND_ALL_GROUPS', payload: { windowId } })
  } else {
    collapseTriggers.value = { ...collapseTriggers.value, [windowId]: (collapseTriggers.value[windowId] || 0) + 1 }
    await chrome.runtime.sendMessage({ action: 'COLLAPSE_ALL_GROUPS', payload: { windowId } })
  }
  windowCollapsedState.value = { ...windowCollapsedState.value, [windowId]: !collapsed }
}

const windowSectionCollapsed = ref<Record<number, boolean>>({})

function isWindowSectionCollapsed(windowId: number): boolean {
  return windowSectionCollapsed.value[windowId] ?? false
}

function toggleWindowSection(windowId: number) {
  windowSectionCollapsed.value = {
    ...windowSectionCollapsed.value,
    [windowId]: !isWindowSectionCollapsed(windowId),
  }
}

const windowTitlesHidden = ref<Record<number, boolean>>({})

function isTitlesHidden(windowId: number): boolean {
  return windowTitlesHidden.value[windowId] ?? false
}

async function handleToggleGroupTitles(windowId: number) {
  const result = await chrome.runtime.sendMessage({ action: 'TOGGLE_GROUP_TITLES', payload: { windowId } })
  if (result?.hidden !== undefined) {
    windowTitlesHidden.value = { ...windowTitlesHidden.value, [windowId]: result.hidden }
  }
}

async function openSearchOverlay() {
  await chrome.runtime.sendMessage({ action: 'TOGGLE_SEARCH_OVERLAY' })
  window.close()
}
</script>

<template>
  <SettingsView v-if="currentView === 'settings'" @back="handleSettingsBack" />

  <div v-else class="w-[360px] min-h-[240px] max-h-[560px] flex flex-col" style="background: var(--bg-primary);">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3" style="box-shadow: 0 0.5px 0 var(--border);">
      <div class="flex items-center gap-2.5">
        <img src="/icons/icon-32.png" alt="" class="w-5 h-5" />
        <h1 class="text-[15px] font-semibold tracking-tight" style="color: var(--text-primary);">TabPilot</h1>
        <span class="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full" style="color: var(--text-tertiary); background: var(--bg-secondary);">{{ totalTabs }}</span>
      </div>
      <div class="flex items-center gap-0.5">
        <!-- Search -->
        <button
          @click="openSearchOverlay"
          class="w-7 h-7 flex items-center justify-center rounded-full"
          style="color: var(--text-secondary);"
          title="Open Search (Ctrl+Shift+F)"
        >
          <svg class="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
        </button>
        <!-- Theme toggle -->
        <button
          @click="toggleTheme"
          class="w-7 h-7 flex items-center justify-center rounded-full"
          style="color: var(--text-secondary);"
          :title="themeMode === 'dark' ? 'Switch to Light' : 'Switch to Dark'"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg v-if="themeMode === 'dark' || (themeMode === 'system' && isDarkActive)" class="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg v-else class="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clip-rule="evenodd" />
          </svg>
        </button>
        <!-- Settings -->
        <button
          class="w-7 h-7 flex items-center justify-center rounded-full"
          style="color: var(--text-secondary);"
          @click="currentView = 'settings'"
          :title="getMessage('settings')"
        >
          <svg class="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center py-16">
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent); animation-delay: 0ms;" />
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent); animation-delay: 150ms;" />
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent); animation-delay: 300ms;" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="totalTabs === 0" class="flex-1 flex items-center justify-center py-16">
      <div class="text-center">
        <div class="w-10 h-10 mx-auto mb-3 rounded-2xl flex items-center justify-center" style="background: var(--bg-secondary);">
          <svg class="w-5 h-5" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
          </svg>
        </div>
        <p class="text-xs" style="color: var(--text-tertiary);">{{ getMessage('noTabs') }}</p>
      </div>
    </div>

    <!-- All windows groups -->
    <div v-else class="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      <div
        v-for="(w, idx) in allWindows"
        :key="w.windowId"
        class="rounded-xl overflow-hidden"
        style="background: var(--bg-secondary); box-shadow: var(--shadow-card);"
      >
        <!-- Window section header (clickable to collapse/expand) -->
        <div
          class="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none"
          @click="toggleWindowSection(w.windowId)"
        >
          <svg
            class="w-3 h-3 shrink-0 transition-transform duration-200"
            :class="isWindowSectionCollapsed(w.windowId) ? '' : 'rotate-90'"
            style="color: var(--text-tertiary);"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
          </svg>
          <svg class="w-3.5 h-3.5 shrink-0" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 01-5.29 0H4.25A2.25 2.25 0 012 12.75v-8.5zM4.25 3.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h3.105a.75.75 0 01.672.418 2.001 2.001 0 003.946 0 .75.75 0 01.672-.418h3.105a.75.75 0 00.75-.75v-8.5a.75.75 0 00-.75-.75H4.25z" clip-rule="evenodd" />
          </svg>
          <span
            class="text-[11px] font-semibold flex-1 truncate"
            :style="{ color: w.windowId === currentWindowId ? 'var(--accent)' : 'var(--text-primary)' }"
          >
            {{ windowLabel(w, idx) }}
          </span>
          <span class="text-[10px] tabular-nums" style="color: var(--text-tertiary);">{{ w.tabCount }} {{ getMessage('tabs') }}</span>
          <span v-if="w.hasGroups" class="w-1.5 h-1.5 rounded-full" style="background: var(--group-green);" :title="getMessage('grouped')" />
        </div>

        <!-- Collapsible content -->
        <template v-if="!isWindowSectionCollapsed(w.windowId)">
          <!-- Action buttons -->
          <div class="flex items-center gap-1.5 px-3.5 pb-2">
            <button
              class="px-3 py-[4px] text-[11px] font-medium rounded-btn"
              style="background: var(--accent); color: #fff;"
              :disabled="groupingWindowId === w.windowId"
              @click="handleGroup(w.windowId)"
            >
              <span v-if="groupingWindowId === w.windowId" class="inline-flex items-center gap-1">
                <span class="animate-spin w-2.5 h-2.5 border border-white/60 border-t-transparent rounded-full" />
                {{ getMessage('grouping') }}
              </span>
              <span v-else>{{ getMessage('groupTabs') }}</span>
            </button>
            <button
              class="px-3 py-[4px] text-[11px] rounded-btn"
              style="color: var(--text-secondary); background: var(--hover);"
              @click="handleUngroup(w.windowId)"
            >
              {{ getMessage('ungroupAll') }}
            </button>
            <button
              v-if="newTabsCount(w) > 0"
              class="px-3 py-[4px] text-[11px] font-medium rounded-btn"
              style="background: var(--accent-soft); color: var(--accent);"
              :disabled="classifyingWindowId === w.windowId"
              @click="handleClassifyNew(w.windowId)"
            >
              <span v-if="classifyingWindowId === w.windowId" class="inline-flex items-center gap-1">
                <span class="animate-spin w-2.5 h-2.5 border border-current/60 border-t-transparent rounded-full" />
                {{ getMessage('classifyingNewTabs') }}
              </span>
              <span v-else>{{ getMessage('classifyNewTabs') }} ({{ newTabsCount(w) }})</span>
            </button>
            <div class="flex-1" />
            <!-- Toolbar icons -->
            <div v-if="w.hasGroups" class="flex items-center gap-0">
              <button
                class="w-6 h-6 flex items-center justify-center rounded-md"
                :style="{ color: isTitlesHidden(w.windowId) ? 'var(--accent)' : 'var(--text-tertiary)' }"
                :title="isTitlesHidden(w.windowId) ? getMessage('showGroupTitles') : getMessage('hideGroupTitles')"
                @click="handleToggleGroupTitles(w.windowId)"
              >
                <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 2a.5.5 0 00-.5.5v3.5a.5.5 0 00.146.354l5.5 5.5a.5.5 0 00.708 0l3.5-3.5a.5.5 0 000-.708l-5.5-5.5A.5.5 0 006 2H2.5zm1.5 2a1 1 0 110 2 1 1 0 010-2z" />
                </svg>
              </button>
              <button
                class="w-6 h-6 flex items-center justify-center rounded-md"
                style="color: var(--text-tertiary);"
                :title="isWindowCollapsed(w.windowId) ? getMessage('expandAll') : getMessage('collapseAll')"
                @click="handleToggleAllGroups(w.windowId)"
              >
                <svg v-if="isWindowCollapsed(w.windowId)" class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 3.5l4 4 4-4" />
                  <path d="M4 8.5l4 4 4-4" />
                </svg>
                <svg v-else class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 7l4-4 4 4" />
                  <path d="M4 12.5l4-4 4 4" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Groups for this window -->
          <div style="background: var(--bg-primary); border-top: 0.5px solid var(--border);">
            <GroupList
              :groups="w.groups"
              :indicator-style="indicatorStyle"
              :expand-trigger="expandTriggers[w.windowId] || 0"
              :collapse-trigger="collapseTriggers[w.windowId] || 0"
              @close-group="loadAllPreviews"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:hover {
  opacity: 0.85;
}
button:active {
  transform: scale(0.97);
}
button:disabled {
  opacity: 0.4;
  pointer-events: none;
}
</style>
