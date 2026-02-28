import type { ClassifyResult, GroupCategory, AIConfig, ChromeTabGroupColor } from '../shared/types'
import { DOMAIN_RULES, KEYWORD_RULES } from '../shared/rules'
import { ALL_CATEGORIES } from '../shared/constants'
import { extractDomain } from '../shared/utils'
import { AIClient } from '../shared/ai-client'

const AI_CONFIDENCE_THRESHOLD = 0.8

/**
 * Classify a tab into a category using the rule engine.
 * Priority: exact domain > parent domain > title keywords > default.
 */
export function classify(url: string | undefined, title: string | undefined): ClassifyResult {
  // 1. Exact domain match
  const domain = extractDomain(url)
  if (domain) {
    const exactMatch = DOMAIN_RULES[domain]
    if (exactMatch) {
      return { category: exactMatch, confidence: 0.95, method: 'domain' }
    }

    // 1.5 Parent domain match
    const parts = domain.split('.')
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.')
      const parentMatch = DOMAIN_RULES[parentDomain]
      if (parentMatch) {
        return { category: parentMatch, confidence: 0.85, method: 'domain' }
      }
    }
  }

  // 2. Title keyword match
  if (title) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(title)) {
        return { category: rule.category, confidence: 0.7, method: 'keyword' }
      }
    }
  }

  // 3. Default
  return { category: 'other', confidence: 0.3, method: 'default' }
}

/**
 * Classify multiple tabs and group them by category (rule engine only).
 */
export function classifyTabs(
  tabs: { url?: string; title?: string; id?: number }[],
): Map<GroupCategory, number[]> {
  const groups = new Map<GroupCategory, number[]>()

  for (const tab of tabs) {
    if (!tab.id) continue
    const result = classify(tab.url, tab.title)
    const existing = groups.get(result.category) || []
    existing.push(tab.id)
    groups.set(result.category, existing)
  }

  return groups
}

/**
 * Classify tabs with AI fallback for low-confidence results.
 * Uses rule engine first, then sends uncertain tabs to AI.
 */
export async function classifyTabsWithAI(
  tabs: { url?: string; title?: string; id?: number }[],
  aiConfig: AIConfig,
): Promise<Map<GroupCategory, number[]>> {
  const groups = new Map<GroupCategory, number[]>()
  const uncertainTabs: { url: string; title: string; id: number }[] = []

  // First pass: rule engine
  for (const tab of tabs) {
    if (!tab.id) continue
    const result = classify(tab.url, tab.title)

    if (result.confidence >= AI_CONFIDENCE_THRESHOLD) {
      const existing = groups.get(result.category) || []
      existing.push(tab.id)
      groups.set(result.category, existing)
    } else {
      uncertainTabs.push({
        url: tab.url || '',
        title: tab.title || '',
        id: tab.id,
      })
    }
  }

  // Second pass: AI for uncertain tabs
  if (uncertainTabs.length > 0 && aiConfig.enabled && aiConfig.apiKey) {
    try {
      const client = new AIClient(aiConfig)
      const aiResults = await client.classifyTabs(
        uncertainTabs.map((t) => ({ url: t.url, title: t.title })),
        ALL_CATEGORIES,
      )

      for (const tab of uncertainTabs) {
        const aiCategory = aiResults.get(tab.url)
        const category = aiCategory || 'other'
        const existing = groups.get(category) || []
        existing.push(tab.id)
        groups.set(category, existing)
      }
    } catch (err) {
      console.error('[TabPilot] AI classification failed, falling back to default:', err)
      // Fallback: put uncertain tabs in "other"
      for (const tab of uncertainTabs) {
        const existing = groups.get('other') || []
        existing.push(tab.id)
        groups.set('other', existing)
      }
    }
  } else {
    // No AI configured — put uncertain tabs in their rule-engine category
    for (const tab of uncertainTabs) {
      const result = classify(tab.url, tab.title)
      const existing = groups.get(result.category) || []
      existing.push(tab.id!)
      groups.set(result.category, existing)
    }
  }

  return groups
}

export interface FreeGroupResult {
  name: string
  color: ChromeTabGroupColor
  tabIds: number[]
}

/**
 * Send all tabs to AI for free-form grouping with custom group names and colors.
 * Throws on failure — caller should catch and fall back to rule engine.
 */
export async function groupTabsFreelyWithAI(
  tabs: { url?: string; title?: string; id?: number }[],
  aiConfig: AIConfig,
): Promise<FreeGroupResult[]> {
  const validTabs = tabs.filter(
    (t): t is { url: string; title: string; id: number } => !!t.id && !!t.url,
  )

  if (validTabs.length === 0) return []

  const client = new AIClient(aiConfig)
  const aiGroups = await client.groupTabsFreely(
    validTabs.map((t) => ({ url: t.url, title: t.title || '' })),
  )

  return aiGroups.map((g) => ({
    name: g.name,
    color: g.color || 'grey',
    tabIds: g.tabIndices.map((i) => validTabs[i - 1].id),
  }))
}
