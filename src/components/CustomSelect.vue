<template>
  <div class="relative" ref="selectRef">
    <!-- 选择器按钮 -->
    <button
      type="button"
      class="custom-select-button"
      :class="{ active: isOpen }"
      @click="toggleDropdown"
    >
      <span class="block truncate text-sm font-medium text-gray-700">
        {{ selectedOption?.name || '请选择格式' }}
      </span>
      <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg
          class="w-5 h-5 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>

    <!-- 下拉选项 -->
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-lg border border-gray-200
               py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="max-h-60 overflow-auto">
          <div
            v-for="option in options"
            :key="option.id"
            class="relative cursor-pointer select-none py-2 pl-4 pr-9 hover:bg-gray-50
                   transition-colors duration-150"
            :class="{
              'bg-blue-50 text-blue-900': option.id === modelValue,
              'text-gray-900': option.id !== modelValue
            }"
            @click="selectOption(option)"
          >
            <div class="flex flex-col">
              <span class="font-medium text-sm">{{ option.name }}</span>
              <span class="text-xs text-gray-500 mt-0.5">{{ option.description }}</span>
            </div>

            <!-- 选中状态指示器 -->
            <span
              v-if="option.id === modelValue"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  :d="icons.check"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import type { ExportFormat } from '@/types';
import { icons } from '@/utils/icons';

interface Props {
  modelValue: string;
  options: ExportFormat[];
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isOpen = ref(false);
const selectRef = ref<HTMLElement>();

const selectedOption = computed(() => {
  return props.options.find(option => option.id === props.modelValue);
});

function toggleDropdown(): void {
  isOpen.value = !isOpen.value;
}

function selectOption(option: ExportFormat): void {
  emit('update:modelValue', option.id);
  isOpen.value = false;
}

function closeDropdown(): void {
  isOpen.value = false;
}

function handleClickOutside(event: MouseEvent): void {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
