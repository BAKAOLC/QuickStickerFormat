<template>
  <svg
    :class="className"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      :d="pathData"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { icons } from '@/utils/icons';

interface Props {
  name: keyof typeof icons;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: 'w-6 h-6',
});

const pathData = computed(() => icons[props.name]);
</script>
