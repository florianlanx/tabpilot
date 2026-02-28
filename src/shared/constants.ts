import type { GroupCategory, GroupDefinition, ExtensionSettings } from './types'

export const GROUP_DEFINITIONS: Record<GroupCategory, GroupDefinition> = {
  work:   { color: 'blue',   labelKey: 'groupWork' },
  dev:    { color: 'green',  labelKey: 'groupDev' },
  learn:  { color: 'purple', labelKey: 'groupLearn' },
  social: { color: 'cyan',   labelKey: 'groupSocial' },
  media:  { color: 'red',    labelKey: 'groupMedia' },
  shop:   { color: 'yellow', labelKey: 'groupShop' },
  docs:   { color: 'pink',   labelKey: 'groupDocs' },
  other:  { color: 'grey',   labelKey: 'groupOther' },
}

export const ALL_CATEGORIES: GroupCategory[] = [
  'work', 'dev', 'learn', 'social', 'media', 'shop', 'docs', 'other',
]

export const DEFAULT_SETTINGS: ExtensionSettings = {
  ai: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
  },
  language: 'auto',
  groupOnStartup: false,
  searchShortcut: 'Ctrl+Shift+F',
  groupIndicatorStyle: 'header',
  smartGroupTitle: true,
  theme: 'system',
}

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  TAB_HISTORY: 'tabHistory',
} as const
