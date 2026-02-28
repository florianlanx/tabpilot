import { describe, it, expect } from 'vitest'
import { searchTabs } from '../src/background/searcher'
import type { TabInfo, TabHistoryEntry } from '../src/shared/types'

const mockTabs: TabInfo[] = [
  { id: 1, url: 'https://github.com/user/repo', title: 'My Repository - GitHub', windowId: 1, index: 0, active: false, pinned: false },
  { id: 2, url: 'https://youtube.com/watch?v=abc', title: 'Learn TypeScript in 2024', windowId: 1, index: 1, active: false, pinned: false },
  { id: 3, url: 'https://docs.google.com/document/d/1', title: 'Project Requirements Document', windowId: 1, index: 2, active: true, pinned: false },
  { id: 4, url: 'https://amazon.com/dp/B123', title: 'Mechanical Keyboard - Amazon', windowId: 1, index: 3, active: false, pinned: false },
  { id: 5, url: 'https://taobao.com/item/456', title: '机械键盘 - 淘宝', windowId: 1, index: 4, active: false, pinned: false },
]

const mockHistory: TabHistoryEntry[] = [
  { url: 'https://stackoverflow.com/q/123', title: 'How to fix TypeScript error TS2345', lastAccessed: Date.now() - 3600000, visitCount: 3, closed: true },
  { url: 'https://reddit.com/r/programming', title: 'r/programming - Reddit', lastAccessed: Date.now() - 86400000, visitCount: 1, closed: true },
]

describe('searchTabs', () => {
  it('returns empty for empty query', () => {
    expect(searchTabs('', mockTabs, mockHistory)).toEqual([])
    expect(searchTabs('   ', mockTabs, mockHistory)).toEqual([])
  })

  it('matches by title', () => {
    const results = searchTabs('TypeScript', mockTabs, mockHistory)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.some((r) => r.tab.url.includes('youtube.com'))).toBe(true)
    expect(results.some((r) => r.tab.url.includes('stackoverflow.com'))).toBe(true)
  })

  it('matches by URL domain', () => {
    const results = searchTabs('github', mockTabs, mockHistory)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].tab.url).toContain('github.com')
  })

  it('marks open tabs correctly', () => {
    const results = searchTabs('Repository', mockTabs, mockHistory)
    const githubResult = results.find((r) => r.tab.url.includes('github.com'))
    expect(githubResult?.isOpen).toBe(true)
  })

  it('marks closed history entries correctly', () => {
    const results = searchTabs('TypeScript error', mockTabs, mockHistory)
    const soResult = results.find((r) => r.tab.url.includes('stackoverflow.com'))
    expect(soResult?.isOpen).toBe(false)
  })

  it('handles multi-word AND search', () => {
    const results = searchTabs('mechanical keyboard', mockTabs, mockHistory)
    expect(results.length).toBeGreaterThanOrEqual(1)
    // Should match Amazon tab
    expect(results.some((r) => r.tab.url.includes('amazon.com'))).toBe(true)
  })

  it('matches Chinese characters', () => {
    const results = searchTabs('机械键盘', mockTabs, mockHistory)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results.some((r) => r.tab.url.includes('taobao.com'))).toBe(true)
  })

  it('sorts by relevance (title match > URL match)', () => {
    const results = searchTabs('github', mockTabs, mockHistory)
    // The tab with "GitHub" in title should score higher
    expect(results[0].tab.title).toContain('GitHub')
  })

  it('limits results to 50', () => {
    // Generate many tabs
    const manyTabs: TabInfo[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 100,
      url: `https://example.com/page${i}`,
      title: `Test Page ${i}`,
      windowId: 1,
      index: i,
      active: false,
      pinned: false,
    }))
    const results = searchTabs('Test', manyTabs, [])
    expect(results.length).toBeLessThanOrEqual(50)
  })
})
