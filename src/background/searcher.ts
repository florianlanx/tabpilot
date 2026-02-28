import type { SearchResult, TabInfo, TabHistoryEntry } from '../shared/types'

/**
 * Search open tabs and history by keyword matching on title and URL.
 * Uses a simple scoring system: title match scores higher than URL match,
 * exact match scores higher than partial.
 */
export function searchTabs(
  query: string,
  openTabs: TabInfo[],
  historyEntries: TabHistoryEntry[],
): SearchResult[] {
  if (!query.trim()) return []

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results: SearchResult[] = []

  // Score open tabs
  for (const tab of openTabs) {
    const score = computeScore(terms, tab.title, tab.url)
    if (score > 0) {
      results.push({ tab, score, isOpen: true })
    }
  }

  // Score history entries (only closed ones, to avoid duplicates with open tabs)
  const openUrls = new Set(openTabs.map((t) => t.url))
  for (const entry of historyEntries) {
    if (openUrls.has(entry.url)) continue
    if (!entry.closed) continue

    const score = computeScore(terms, entry.title, entry.url)
    if (score > 0) {
      // Boost by recency (decay over 7 days)
      const ageMs = Date.now() - entry.lastAccessed
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const recencyBoost = Math.max(0, 1 - ageDays / 7) * 0.2
      results.push({ tab: entry, score: score + recencyBoost, isOpen: false })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, 50)
}

/**
 * Compute a relevance score for a tab against search terms.
 */
function computeScore(terms: string[], title: string, url: string): number {
  const titleLower = (title || '').toLowerCase()
  const urlLower = (url || '').toLowerCase()

  let totalScore = 0

  for (const term of terms) {
    let termScore = 0

    // Title exact word match
    if (titleLower.includes(term)) {
      termScore += 3
      // Bonus for word boundary match
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i')
      if (regex.test(title || '')) {
        termScore += 1
      }
      // Bonus for match at start
      if (titleLower.startsWith(term)) {
        termScore += 1
      }
    }

    // URL match (lower weight)
    if (urlLower.includes(term)) {
      termScore += 1
      // Domain match bonus
      try {
        const domain = new URL(url).hostname.toLowerCase()
        if (domain.includes(term)) {
          termScore += 1
        }
      } catch {
        // ignore
      }
    }

    if (termScore === 0) {
      // If any term doesn't match, return 0 (AND logic)
      return 0
    }
    totalScore += termScore
  }

  return totalScore
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
