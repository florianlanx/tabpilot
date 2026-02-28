import type { TabHistoryEntry } from '../shared/types'
import { STORAGE_KEYS } from '../shared/constants'

const MAX_HISTORY_ENTRIES = 500

/**
 * Load tab history from storage.
 */
export async function loadHistory(): Promise<Map<string, TabHistoryEntry>> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TAB_HISTORY)
  const entries = (data[STORAGE_KEYS.TAB_HISTORY] ?? []) as TabHistoryEntry[]
  const map = new Map<string, TabHistoryEntry>()
  for (const entry of entries) {
    map.set(entry.url, entry)
  }
  return map
}

/**
 * Save tab history to storage.
 */
async function saveHistory(history: Map<string, TabHistoryEntry>): Promise<void> {
  // Keep only the most recent entries
  let entries = Array.from(history.values())
  if (entries.length > MAX_HISTORY_ENTRIES) {
    entries.sort((a, b) => b.lastAccessed - a.lastAccessed)
    entries = entries.slice(0, MAX_HISTORY_ENTRIES)
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.TAB_HISTORY]: entries })
}

/**
 * Record a tab visit in history.
 */
export async function recordTabVisit(url: string, title: string, favIconUrl?: string): Promise<void> {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return

  const history = await loadHistory()
  const existing = history.get(url)

  history.set(url, {
    url,
    title,
    favIconUrl,
    lastAccessed: Date.now(),
    visitCount: (existing?.visitCount || 0) + 1,
    closed: false,
  })

  await saveHistory(history)
}

/**
 * Mark a tab as closed in history.
 */
export async function markTabClosed(url: string): Promise<void> {
  if (!url) return
  const history = await loadHistory()
  const entry = history.get(url)
  if (entry) {
    entry.closed = true
    entry.lastAccessed = Date.now()
    history.set(url, entry)
    await saveHistory(history)
  }
}

/**
 * Get all history entries.
 */
export async function getHistoryEntries(): Promise<TabHistoryEntry[]> {
  const history = await loadHistory()
  return Array.from(history.values()).sort((a, b) => b.lastAccessed - a.lastAccessed)
}
