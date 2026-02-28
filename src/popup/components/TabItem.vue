<script setup lang="ts">
import type { TabInfo } from '../../shared/types'

defineProps<{
  tab: TabInfo
}>()

function switchToTab(tabId: number) {
  chrome.tabs.update(tabId, { active: true })
}

function getFaviconUrl(tab: TabInfo): string {
  if (tab.favIconUrl) return tab.favIconUrl
  try {
    const url = new URL(tab.url)
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url.href)}&size=16`
  } catch {
    return ''
  }
}
</script>

<template>
  <button
    class="tab-row w-full flex items-center gap-2.5 px-2 py-[5px] rounded-lg text-left group"
    @click="switchToTab(tab.id)"
    :title="tab.url"
  >
    <div class="w-4 h-4 shrink-0 rounded flex items-center justify-center overflow-hidden" style="background: var(--bg-secondary);">
      <img
        v-if="getFaviconUrl(tab)"
        :src="getFaviconUrl(tab)"
        alt=""
        class="w-3.5 h-3.5"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>
    <span class="text-xs truncate" style="color: var(--text-primary);">
      {{ tab.title || 'Untitled' }}
    </span>
  </button>
</template>

<style scoped>
.tab-row:hover {
  background: var(--hover);
}
.tab-row:active {
  transform: scale(0.99);
}
</style>
