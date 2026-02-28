import type { AIConfig, AIGroupResult, ChromeTabGroupColor, GroupCategory } from './types'

const SYSTEM_PROMPT = 'You are a helpful assistant that classifies browser tabs into categories. Be concise.'

const DEFAULT_MODELS: Record<AIConfig['provider'], string> = {
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.5-flash',
  custom: 'gpt-4o-mini',
}

const VALID_COLORS: ChromeTabGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan',
]

const MAX_GROUP_NAME_LENGTH = 40

const BATCH_SIZE = 20

/**
 * Unified AI client that supports OpenAI, Claude, Gemini, and custom endpoints.
 */
export class AIClient {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  /**
   * Test the connection with a simple request.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.chat('Respond with exactly: OK')
      return { ok: response.includes('OK') }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  /**
   * Classify tabs that the rule engine couldn't confidently categorize.
   */
  async classifyTabs(
    tabs: { url: string; title: string }[],
    categories: GroupCategory[],
  ): Promise<Map<string, GroupCategory>> {
    if (tabs.length === 0) return new Map()

    const tabDescriptions = tabs
      .map((t, i) => `${i + 1}. [${t.title}] ${t.url}`)
      .join('\n')

    const prompt = `Classify each browser tab into one of these categories: ${categories.join(', ')}.

Tabs:
${tabDescriptions}

Respond with a JSON array where each element has "index" (1-based) and "category". Example:
[{"index": 1, "category": "dev"}, {"index": 2, "category": "media"}]

Only output the JSON array, no other text.`

    const response = await this.chat(prompt)

    // Parse response
    const result = new Map<string, GroupCategory>()
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { index: number; category: string }[]
        for (const item of parsed) {
          const tab = tabs[item.index - 1]
          if (tab && categories.includes(item.category as GroupCategory)) {
            result.set(tab.url, item.category as GroupCategory)
          }
        }
      }
    } catch {
      console.error('[TabPilot] Failed to parse AI response:', response)
    }

    return result
  }

  /**
   * Let AI freely group tabs into dynamic groups with custom names and colors.
   * Splits into batches when tab count exceeds BATCH_SIZE.
   */
  async groupTabsFreely(
    tabs: { url: string; title: string }[],
  ): Promise<AIGroupResult[]> {
    if (tabs.length === 0) return []

    if (tabs.length <= BATCH_SIZE) {
      return this.groupTabsBatch(tabs, 0)
    }

    const allResults: AIGroupResult[] = []
    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE)
      const batchResults = await this.groupTabsBatch(batch, i)
      allResults.push(...batchResults)
    }
    return allResults
  }

  private formatTabForPrompt(tab: { url: string; title: string }, index: number): string {
    const domain = new URL(tab.url).hostname.replace(/^www\./, '')
    const shortTitle = tab.title.length > 40 ? tab.title.slice(0, 40) + '…' : tab.title
    return `${index}. ${shortTitle} (${domain})`
  }

  private async groupTabsBatch(
    tabs: { url: string; title: string }[],
    offset: number,
  ): Promise<AIGroupResult[]> {
    const tabDescriptions = tabs
      .map((t, i) => this.formatTabForPrompt(t, offset + i + 1))
      .join('\n')

    const prompt = `Organize these browser tabs into groups.
Create 2-8 groups. Each needs a short name (2-4 words, same language as tab titles).
Colors: grey,blue,red,yellow,green,pink,purple,cyan

Tabs:
${tabDescriptions}

JSON format: [{"name":"...","color":"...","tabIndices":[1,2]}]`

    const response = await this.chat(prompt, true)
    return this.parseFreeGroupResponse(response, offset + tabs.length, offset + 1)
  }

  private parseFreeGroupResponse(response: string, maxIndex: number, minIndex = 1): AIGroupResult[] {
    // Strip markdown code fences if present
    let cleaned = response.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }

    // Find the start of the JSON array
    const startIdx = cleaned.indexOf('[')
    if (startIdx === -1) {
      throw new Error(`No JSON array found in AI response: ${response.slice(0, 200)}`)
    }

    let jsonStr = cleaned.slice(startIdx)

    // Clean trailing commas before ] or } (common LLM mistake)
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

    // Try to parse directly first
    let parsed: { name: string; tabIndices: number[]; color?: string }[]
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      // Likely truncated. Repair: find the last complete object and close the array.
      const lastCompleteObj = jsonStr.lastIndexOf('}')
      if (lastCompleteObj <= 0) {
        throw new Error(`Truncated AI response with no complete objects: ${response.slice(0, 200)}`)
      }
      jsonStr = jsonStr.slice(0, lastCompleteObj + 1) + ']'
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        throw new Error(`Failed to parse AI JSON: ${jsonStr.slice(0, 300)}`)
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI returned empty or invalid groups')
    }

    const assignedIndices = new Set<number>()
    const results: AIGroupResult[] = []

    for (let gi = 0; gi < parsed.length; gi++) {
      const group = parsed[gi]
      if (!group.name || !Array.isArray(group.tabIndices)) continue

      const validIndices: number[] = []
      for (const idx of group.tabIndices) {
        if (idx >= minIndex && idx <= maxIndex && !assignedIndices.has(idx)) {
          assignedIndices.add(idx)
          validIndices.push(idx)
        }
      }

      if (validIndices.length === 0) continue

      const color: ChromeTabGroupColor = VALID_COLORS.includes(group.color as ChromeTabGroupColor)
        ? (group.color as ChromeTabGroupColor)
        : VALID_COLORS[gi % VALID_COLORS.length]

      results.push({
        name: group.name.slice(0, MAX_GROUP_NAME_LENGTH),
        tabIndices: validIndices,
        color,
      })
    }

    // Collect unassigned tabs into an "Other" group
    const unassigned: number[] = []
    for (let i = minIndex; i <= maxIndex; i++) {
      if (!assignedIndices.has(i)) unassigned.push(i)
    }
    if (unassigned.length > 0) {
      results.push({ name: 'Other', tabIndices: unassigned, color: 'grey' })
    }

    return results
  }

  /**
   * Classify new tabs into existing groups by name.
   * Returns a map of tab index (0-based) to target group name,
   * or a new group descriptor if no existing group fits.
   */
  async classifyNewTabsIntoGroups(
    tabs: { url: string; title: string }[],
    existingGroupNames: string[],
  ): Promise<{ index: number; group: string; newGroupName?: string; newGroupColor?: string }[]> {
    if (tabs.length === 0) return []

    const tabDescriptions = tabs
      .map((t, i) => this.formatTabForPrompt(t, i + 1))
      .join('\n')

    const prompt = `I have these existing tab groups: ${existingGroupNames.map((n) => `"${n}"`).join(', ')}.

New tabs to classify:
${tabDescriptions}

For each tab, decide which existing group it belongs to. If none fit, use "NEW" and suggest a name and color.
Colors: grey,blue,red,yellow,green,pink,purple,cyan

JSON format: [{"index":1,"group":"existing group name"}] or [{"index":2,"group":"NEW","newGroupName":"...","newGroupColor":"blue"}]
Only output the JSON array.`

    const response = await this.chat(prompt, true)

    try {
      const cleaned = response.trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return this.fallbackAllToNew(tabs)

      let jsonStr = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(jsonStr) as {
        index: number
        group: string
        newGroupName?: string
        newGroupColor?: string
      }[]

      const validGroupNames = new Set(existingGroupNames)
      return parsed
        .filter((item) => item.index >= 1 && item.index <= tabs.length)
        .map((item) => ({
          index: item.index - 1,
          group: item.group === 'NEW' ? 'NEW' : (validGroupNames.has(item.group) ? item.group : 'NEW'),
          newGroupName: item.newGroupName?.slice(0, MAX_GROUP_NAME_LENGTH),
          newGroupColor: VALID_COLORS.includes(item.newGroupColor as ChromeTabGroupColor)
            ? item.newGroupColor
            : undefined,
        }))
    } catch {
      console.error('[TabPilot] Failed to parse classify-new-tabs response:', response)
      return this.fallbackAllToNew(tabs)
    }
  }

  private fallbackAllToNew(tabs: { url: string; title: string }[]): { index: number; group: string }[] {
    return tabs.map((_, i) => ({ index: i, group: 'NEW', newGroupName: 'Uncategorized', newGroupColor: 'grey' }))
  }

  /**
   * Generate embeddings for semantic search (OpenAI only).
   */
  async getEmbeddings(texts: string[]): Promise<number[][] | null> {
    if (this.config.provider !== 'openai') return null

    try {
      const response = await fetch(`${this.getBaseUrl()}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      })

      if (!response.ok) return null

      const data = await response.json()
      return data.data.map((d: { embedding: number[] }) => d.embedding)
    } catch {
      return null
    }
  }

  /**
   * Send a chat completion request.
   */
  private async chat(userMessage: string, jsonMode?: boolean): Promise<string> {
    const { provider } = this.config

    if (provider === 'claude') {
      return this.chatClaude(userMessage, jsonMode)
    }

    if (provider === 'gemini') {
      return this.chatGemini(userMessage, jsonMode)
    }

    // OpenAI / Custom (OpenAI-compatible)
    return this.chatOpenAI(userMessage, jsonMode)
  }

  private get defaultModel(): string {
    return DEFAULT_MODELS[this.config.provider]
  }

  private async chatOpenAI(userMessage: string, jsonMode?: boolean): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        max_tokens: 4096,
        ...(jsonMode && { response_format: { type: 'json_object' } }),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  private async chatClaude(userMessage: string, jsonMode?: boolean): Promise<string> {
    const baseUrl = this.config.endpoint || 'https://api.anthropic.com'
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: userMessage },
      ...(jsonMode ? [{ role: 'assistant', content: '[' }] : []),
    ]
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''
    return jsonMode ? '[' + text : text
  }

  private async chatGemini(userMessage: string, jsonMode?: boolean): Promise<string> {
    const baseUrl = this.config.endpoint || 'https://generativelanguage.googleapis.com'
    const model = this.config.model || this.defaultModel
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            { role: 'user', parts: [{ text: userMessage }] },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            ...(jsonMode && { responseMimeType: 'application/json' }),
          },
        }),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  private getBaseUrl(): string {
    return this.config.endpoint || 'https://api.openai.com/v1'
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    }
  }
}
