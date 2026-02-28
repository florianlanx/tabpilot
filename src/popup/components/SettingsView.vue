<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getMessage } from '../../shared/i18n'
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../shared/constants'
import type { ExtensionSettings } from '../../shared/types'
import { AIClient } from '../../shared/ai-client'

const emit = defineEmits<{
  back: []
}>()

const settings = ref<ExtensionSettings>({ ...DEFAULT_SETTINGS })
const saved = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; error?: string } | null>(null)
const searchShortcut = ref('Ctrl+Shift+F')

const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  custom: '',
}

const modelPlaceholder = computed(() => {
  const placeholders: Record<string, string> = {
    openai: 'gpt-4o-mini',
    claude: 'claude-sonnet-4-20250514',
    gemini: 'gemini-2.5-flash',
    custom: 'gpt-4o-mini',
  }
  return placeholders[settings.value.ai.provider] || 'gpt-4o-mini'
})

const endpointPlaceholder = computed(() =>
  DEFAULT_ENDPOINTS[settings.value.ai.provider] || 'https://api.example.com/v1'
)

watch(() => settings.value.ai.provider, (newProvider, oldProvider) => {
  if (!oldProvider) return
  const oldDefault = DEFAULT_ENDPOINTS[oldProvider]
  const current = settings.value.ai.endpoint
  if (!current || current === oldDefault) {
    settings.value.ai.endpoint = DEFAULT_ENDPOINTS[newProvider] || ''
  }
})

onMounted(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  if (stored) {
    settings.value = { ...DEFAULT_SETTINGS, ...stored }
  }
  if (!settings.value.ai.endpoint) {
    settings.value.ai.endpoint = DEFAULT_ENDPOINTS[settings.value.ai.provider] || ''
  }
  const commands = await chrome.commands.getAll()
  const searchCmd = commands.find((c) => c.name === 'open-search')
  if (searchCmd?.shortcut) {
    searchShortcut.value = searchCmd.shortcut
  }
})

function openShortcutSettings() {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
}

async function saveSettings() {
  await chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', payload: settings.value })
  saved.value = true
  setTimeout(() => { emit('back') }, 600)
}

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const client = new AIClient(settings.value.ai)
    testResult.value = await client.testConnection()
  } catch (err) {
    testResult.value = { ok: false, error: (err as Error).message }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="w-[360px] max-h-[500px] flex flex-col" style="background: var(--bg-primary);">
    <!-- Header -->
    <header class="flex items-center gap-2.5 px-4 py-3" style="box-shadow: 0 0.5px 0 var(--border);">
      <button
        @click="emit('back')"
        class="w-7 h-7 -ml-1 flex items-center justify-center rounded-full"
        style="color: var(--accent);"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
        </svg>
      </button>
      <h1 class="text-[15px] font-semibold tracking-tight" style="color: var(--text-primary);">{{ getMessage('settings') }}</h1>
    </header>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4" style="background: var(--bg-secondary);">

      <!-- AI Configuration -->
      <div>
        <h2 class="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5" style="color: var(--text-secondary);">
          {{ getMessage('aiConfig') }}
          <span class="text-[9px] font-normal normal-case tracking-normal px-1.5 py-0.5 rounded-full" style="background: var(--hover); color: var(--text-tertiary);">{{ getMessage('optional') }}</span>
        </h2>
        <div class="rounded-xl overflow-hidden" style="background: var(--bg-primary); box-shadow: var(--shadow-xs);">
          <!-- Enable toggle -->
          <label class="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer setting-row">
            <span class="text-xs flex-1" style="color: var(--text-primary);">{{ getMessage('enableAI') }}</span>
            <div class="relative">
              <input
                type="checkbox"
                v-model="settings.ai.enabled"
                class="sr-only peer"
              />
              <div class="toggle-track w-[38px] h-[22px] rounded-full transition-colors duration-200"></div>
              <div class="absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></div>
            </div>
          </label>

          <template v-if="settings.ai.enabled">
            <!-- Provider -->
            <div class="px-3.5 py-2.5 setting-row">
              <label class="block text-[10px] font-medium mb-1" style="color: var(--text-secondary);">{{ getMessage('provider') }}</label>
              <select
                v-model="settings.ai.provider"
                class="w-full text-xs rounded-lg border-0 py-2 px-2.5"
                style="background: var(--bg-secondary); color: var(--text-primary);"
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Claude (Anthropic)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </div>

            <!-- API Key -->
            <div class="px-3.5 py-2.5 setting-row">
              <label class="block text-[10px] font-medium mb-1" style="color: var(--text-secondary);">{{ getMessage('apiKey') }}</label>
              <input
                type="password"
                v-model="settings.ai.apiKey"
                placeholder="sk-... / AIza..."
                class="w-full text-xs rounded-lg border-0 py-2 px-2.5"
                style="background: var(--bg-secondary); color: var(--text-primary);"
              />
            </div>

            <!-- Endpoint -->
            <div class="px-3.5 py-2.5 setting-row">
              <label class="block text-[10px] font-medium mb-1" style="color: var(--text-secondary);">{{ getMessage('endpoint') }}</label>
              <input
                type="url"
                v-model="settings.ai.endpoint"
                :placeholder="endpointPlaceholder"
                class="w-full text-xs rounded-lg border-0 py-2 px-2.5"
                style="background: var(--bg-secondary); color: var(--text-primary);"
              />
            </div>

            <!-- Model -->
            <div class="px-3.5 py-2.5 setting-row">
              <label class="block text-[10px] font-medium mb-1" style="color: var(--text-secondary);">
                {{ getMessage('model') }}
                <span style="color: var(--text-tertiary);">({{ getMessage('optional') }})</span>
              </label>
              <input
                type="text"
                v-model="settings.ai.model"
                :placeholder="modelPlaceholder"
                class="w-full text-xs rounded-lg border-0 py-2 px-2.5"
                style="background: var(--bg-secondary); color: var(--text-primary);"
              />
            </div>

            <!-- Test connection -->
            <div class="flex items-center gap-2.5 px-3.5 py-2.5">
              <button
                @click="testConnection"
                :disabled="testing || !settings.ai.apiKey"
                class="px-3.5 py-1.5 text-[11px] font-medium rounded-lg disabled:opacity-40"
                style="background: var(--bg-secondary); color: var(--text-primary);"
              >
                {{ testing ? getMessage('testing') : getMessage('testConnection') }}
              </button>
              <span v-if="testResult?.ok" class="text-[11px] font-medium" style="color: var(--group-green);">{{ getMessage('connected') }}</span>
              <span v-else-if="testResult" class="text-[11px]" style="color: var(--group-red);">{{ testResult.error || getMessage('failed') }}</span>
            </div>
          </template>

          <div class="px-3.5 py-2.5">
            <p class="text-[10px] leading-relaxed" style="color: var(--text-tertiary);">
              {{ getMessage('apiKeyNote') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Keyboard Shortcut -->
      <div>
        <h2 class="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1.5" style="color: var(--text-secondary);">
          {{ getMessage('shortcutTitle') }}
        </h2>
        <div class="rounded-xl overflow-hidden" style="background: var(--bg-primary); box-shadow: var(--shadow-xs);">
          <div class="flex items-center justify-between px-3.5 py-3">
            <div>
              <div class="text-xs" style="color: var(--text-primary);">{{ getMessage('searchPlaceholder').replace('...', '') }}</div>
              <kbd class="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-mono rounded-md" style="background: var(--bg-secondary); color: var(--text-secondary);">{{ searchShortcut }}</kbd>
            </div>
            <button
              @click="openShortcutSettings"
              class="px-3 py-1.5 text-[11px] font-medium rounded-lg"
              style="color: var(--accent);"
            >
              {{ getMessage('changeShortcut') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Display Settings -->
      <div>
        <h2 class="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1.5" style="color: var(--text-secondary);">
          {{ getMessage('displaySettings') }}
        </h2>
        <div class="rounded-xl overflow-hidden" style="background: var(--bg-primary); box-shadow: var(--shadow-xs);">
          <!-- Group indicator style -->
          <div class="px-3.5 py-3">
            <label class="block text-[10px] font-medium mb-2.5" style="color: var(--text-secondary);">
              {{ getMessage('groupIndicatorStyle') }}
            </label>
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Classic mode card -->
              <label
                class="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all"
                :style="settings.groupIndicatorStyle === 'header'
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                  : { borderColor: 'var(--border)', background: 'transparent' }"
              >
                <input type="radio" v-model="settings.groupIndicatorStyle" value="header" class="sr-only" />
                <div class="w-full space-y-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full" style="background: var(--accent);" />
                    <span class="h-1 flex-1 rounded-full" style="background: var(--text-tertiary); opacity: 0.4;" />
                  </div>
                  <div class="pl-3 space-y-1">
                    <div class="h-1 w-3/4 rounded-full" style="background: var(--text-tertiary); opacity: 0.25;" />
                    <div class="h-1 w-1/2 rounded-full" style="background: var(--text-tertiary); opacity: 0.25;" />
                  </div>
                </div>
                <span class="text-[10px] font-medium" style="color: var(--text-primary);">
                  {{ getMessage('styleHeader') }}
                </span>
              </label>
              <!-- Minimal mode card -->
              <label
                class="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all"
                :style="settings.groupIndicatorStyle === 'bar'
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                  : { borderColor: 'var(--border)', background: 'transparent' }"
              >
                <input type="radio" v-model="settings.groupIndicatorStyle" value="bar" class="sr-only" />
                <div class="w-full space-y-1">
                  <div class="flex items-center gap-1.5">
                    <span class="w-[2px] h-3 rounded-full" style="background: var(--accent);" />
                    <span class="h-1 flex-1 rounded-full" style="background: var(--text-tertiary); opacity: 0.25;" />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-[2px] h-3 rounded-full" style="background: var(--accent);" />
                    <span class="h-1 w-3/4 rounded-full" style="background: var(--text-tertiary); opacity: 0.25;" />
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-[2px] h-3 rounded-full" style="background: var(--group-green);" />
                    <span class="h-1 w-2/3 rounded-full" style="background: var(--text-tertiary); opacity: 0.25;" />
                  </div>
                </div>
                <span class="text-[10px] font-medium" style="color: var(--text-primary);">
                  {{ getMessage('styleBar') }}
                </span>
              </label>
            </div>
          </div>

          <!-- Divider -->
          <div class="mx-3.5" style="height: 0.5px; background: var(--border);" />

          <!-- Smart group title toggle -->
          <label class="flex items-start gap-3 px-3.5 py-3 cursor-pointer">
            <div class="flex-1">
              <span class="text-xs block" style="color: var(--text-primary);">{{ getMessage('smartGroupTitle') }}</span>
              <p class="text-[10px] mt-0.5 leading-relaxed" style="color: var(--text-tertiary);">
                {{ getMessage('smartGroupTitleDesc') }}
              </p>
            </div>
            <div class="relative mt-0.5">
              <input
                type="checkbox"
                v-model="settings.smartGroupTitle"
                class="sr-only peer"
              />
              <div class="toggle-track w-[38px] h-[22px] rounded-full transition-colors duration-200"></div>
              <div class="absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></div>
            </div>
          </label>
        </div>
      </div>

      <!-- Save button -->
      <div class="pb-1">
        <button
          @click="saveSettings"
          class="w-full py-2.5 text-[13px] font-semibold rounded-xl transition-all"
          style="background: var(--accent); color: #fff;"
        >
          <span v-if="saved" class="inline-flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
            </svg>
            {{ getMessage('saved') }}
          </span>
          <span v-else>{{ getMessage('save') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setting-row {
  border-bottom: 0.5px solid var(--border);
}
.setting-row:last-child {
  border-bottom: none;
}
button:hover {
  opacity: 0.85;
}
button:active {
  transform: scale(0.98);
}
button:disabled {
  opacity: 0.4;
  pointer-events: none;
}
select, input[type="text"], input[type="password"], input[type="url"] {
  outline: none;
}
select:focus, input:focus {
  box-shadow: 0 0 0 2px var(--accent-soft);
}

/* iOS-style toggle switch */
.toggle-track {
  background: var(--text-tertiary);
}
.peer:checked ~ .toggle-track {
  background: var(--accent);
}
</style>
