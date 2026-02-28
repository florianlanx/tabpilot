export interface TabInfo {
  id: number
  url: string
  title: string
  favIconUrl?: string
  windowId: number
  index: number
  active: boolean
  pinned: boolean
}

export interface ClassifyResult {
  category: GroupCategory
  confidence: number
  method: 'domain' | 'keyword' | 'ai' | 'default'
}

export type GroupCategory = 'work' | 'dev' | 'learn' | 'social' | 'media' | 'shop' | 'docs' | 'other'

export type ChromeTabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan'

export interface GroupDefinition {
  color: ChromeTabGroupColor
  labelKey: string
}

export interface GroupedTabs {
  category: GroupCategory
  tabs: TabInfo[]
  groupName?: string
  groupColor?: ChromeTabGroupColor
}

export interface AIGroupResult {
  name: string
  tabIndices: number[]
  color?: ChromeTabGroupColor
}

export interface TabHistoryEntry {
  url: string
  title: string
  favIconUrl?: string
  lastAccessed: number
  visitCount: number
  closed: boolean
}

export interface SearchResult {
  tab: TabInfo | TabHistoryEntry
  score: number
  isOpen: boolean
}

export interface AIConfig {
  enabled: boolean
  provider: 'openai' | 'claude' | 'gemini' | 'custom'
  apiKey: string
  endpoint?: string
  model?: string
}

export type GroupIndicatorStyle = 'header' | 'bar'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ExtensionSettings {
  ai: AIConfig
  language: 'auto' | 'en' | 'zh_CN'
  groupOnStartup: boolean
  searchShortcut: string
  groupIndicatorStyle: GroupIndicatorStyle
  smartGroupTitle: boolean
  theme: ThemeMode
}

export interface WindowGroupsInfo {
  windowId: number
  tabCount: number
  focused: boolean
  groups: GroupedTabs[]
  hasGroups: boolean
  titlesHidden: boolean
}

export type MessageAction =
  | 'GROUP_TABS'
  | 'UNGROUP_ALL'
  | 'CLOSE_GROUP'
  | 'CLASSIFY_NEW_TABS'
  | 'EXPAND_ALL_GROUPS'
  | 'COLLAPSE_ALL_GROUPS'
  | 'TOGGLE_GROUP_TITLES'
  | 'SEARCH_TABS'
  | 'GET_GROUPS_PREVIEW'
  | 'REFRESH_GROUPS_PREVIEW'
  | 'GET_ALL_WINDOWS_PREVIEW'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TOGGLE_SEARCH_OVERLAY'
  | 'SWITCH_TAB'
  | 'OPEN_URL'

export interface ExtensionMessage {
  action: MessageAction
  payload?: unknown
}
