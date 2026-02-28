<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { GROUP_DEFINITIONS } from '../../shared/constants'
import { getMessage } from '../../shared/i18n'
import type { GroupedTabs, GroupIndicatorStyle } from '../../shared/types'
import TabItem from './TabItem.vue'

const props = withDefaults(defineProps<{
  group: GroupedTabs
  mode: GroupIndicatorStyle
  expandTrigger: number
  collapseTrigger: number
}>(), {
  mode: 'header',
  expandTrigger: 0,
  collapseTrigger: 0,
})

const emit = defineEmits<{
  'close-group': []
}>()

const collapsed = ref(props.mode === 'header')

watch(() => props.expandTrigger, () => { collapsed.value = false })
watch(() => props.collapseTrigger, () => { collapsed.value = true })

const def = GROUP_DEFINITIONS[props.group.category]

const displayColor = computed(() => props.group.groupColor || def.color)
const displayLabel = computed(() => props.group.groupName || getMessage(def.labelKey))

const groupColorVar = computed(() => `var(--group-${displayColor.value})`)

async function handleCloseGroup() {
  const tabIds = props.group.tabs.map((t) => t.id)
  await chrome.runtime.sendMessage({ action: 'CLOSE_GROUP', payload: { tabIds } })
  emit('close-group')
}
</script>

<template>
  <div class="group/item">
    <!-- Collapsed chip -->
    <template v-if="collapsed">
      <button
        class="w-full flex items-center gap-2.5 px-3.5 py-2 text-left group/row"
        @click="collapsed = false"
      >
        <span
          class="min-w-[22px] h-[22px] rounded-md flex items-center justify-center text-white text-[10px] font-bold px-1 tabular-nums"
          :style="{ background: groupColorVar }"
        >
          {{ group.tabs.length }}
        </span>
        <span class="text-xs font-medium flex-1 truncate" style="color: var(--text-primary);">{{ displayLabel }}</span>
        <button
          class="p-1 rounded-md opacity-0 group-hover/row:opacity-100"
          style="color: var(--text-tertiary);"
          :title="getMessage('closeGroup')"
          @click.stop="handleCloseGroup"
        >
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <svg class="w-3 h-3" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
      </button>
    </template>

    <!-- Header mode: expanded -->
    <template v-else-if="mode === 'header'">
      <button
        class="w-full flex items-center gap-2.5 px-3.5 py-2 text-left group/row"
        @click="collapsed = true"
      >
        <span class="w-[3px] h-4 rounded-full shrink-0" :style="{ background: groupColorVar }" />
        <span class="text-xs font-medium flex-1 truncate" style="color: var(--text-primary);">
          {{ displayLabel }}
        </span>
        <span class="text-[10px] tabular-nums" style="color: var(--text-tertiary);">{{ group.tabs.length }}</span>
        <button
          class="p-1 rounded-md opacity-0 group-hover/row:opacity-100"
          style="color: var(--text-tertiary);"
          :title="getMessage('closeGroup')"
          @click.stop="handleCloseGroup"
        >
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <svg
          class="w-3 h-3 rotate-90"
          style="color: var(--text-tertiary);"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
      </button>
      <div class="pl-6 pr-2 pb-1">
        <TabItem v-for="tab in group.tabs" :key="tab.id" :tab="tab" />
      </div>
    </template>

    <!-- Bar mode: expanded with colored vertical bar -->
    <template v-else>
      <div class="relative group/bar">
        <div
          class="absolute left-0 top-0 bottom-0 w-4 cursor-pointer z-10 flex items-start"
          :title="displayLabel + ' (' + group.tabs.length + ')'"
          @click="collapsed = true"
        >
          <div
            class="absolute left-1.5 top-1 bottom-1 w-[3px] rounded-full transition-all duration-200"
            :style="{ background: groupColorVar }"
          />
        </div>
        <button
          class="absolute left-0 top-0 w-4 h-4 flex items-center justify-center transition-all opacity-0 group-hover/bar:opacity-100 z-20"
          style="color: var(--text-tertiary);"
          :title="getMessage('closeGroup')"
          @click.stop="handleCloseGroup"
        >
          <svg class="w-2 h-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <div class="pl-5 pr-2 py-0.5">
          <TabItem v-for="tab in group.tabs" :key="tab.id" :tab="tab" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
button.group\/row:hover,
.group\/row:hover {
  background: var(--hover);
}
button:active {
  transform: scale(0.99);
}
</style>
