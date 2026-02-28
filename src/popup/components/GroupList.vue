<script setup lang="ts">
import type { GroupedTabs, GroupIndicatorStyle } from '../../shared/types'
import GroupItem from './GroupItem.vue'

withDefaults(defineProps<{
  groups: GroupedTabs[]
  indicatorStyle: GroupIndicatorStyle
  expandTrigger: number
  collapseTrigger: number
}>(), {
  indicatorStyle: 'header',
  expandTrigger: 0,
  collapseTrigger: 0,
})

const emit = defineEmits<{
  'close-group': []
}>()
</script>

<template>
  <div v-if="groups.length === 0" class="flex items-center justify-center py-8">
    <div class="text-center">
      <div class="w-8 h-8 mx-auto mb-2 rounded-xl flex items-center justify-center" style="background: var(--bg-secondary);">
        <svg class="w-4 h-4" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
        </svg>
      </div>
      <p class="text-[11px]" style="color: var(--text-tertiary);">No tabs to group</p>
    </div>
  </div>
  <div v-else class="py-1" :class="indicatorStyle === 'bar' ? 'space-y-0' : 'space-y-0'">
    <GroupItem
      v-for="group in groups"
      :key="group.groupName || group.category"
      :group="group"
      :mode="indicatorStyle"
      :expand-trigger="expandTrigger"
      :collapse-trigger="collapseTrigger"
      @close-group="emit('close-group')"
    />
  </div>
</template>
