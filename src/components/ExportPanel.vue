<template>
  <div class="card">
    <h2 class="text-lg font-medium text-gray-900 mb-4">导出设置</h2>

    <!-- 当前格式信息 -->
    <div class="mb-4 p-3 bg-gray-50 rounded-lg">
      <h3 class="font-medium text-gray-900">{{ store.currentFormat?.name }}</h3>
      <p class="text-sm text-gray-600 mt-1">{{ store.currentFormat?.description }}</p>

      <div class="mt-2 space-y-1 text-xs text-gray-500">
        <div>
          数量要求：
          <template v-if="allowVariable">{{ minCount }}~{{ maxCount }}</template>
          <template v-else>{{ fixedCount }}</template>
          张
        </div>
      </div>
    </div>

    <!-- 状态检查 -->
    <div class="mb-4 space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span>图片数量</span>
        <span :class="getImageCountStatusClass">
          {{ getImageCountStatusText }}
        </span>
      </div>

      <!-- 数量不符合要求时的提示 -->
      <div v-if="!store.isValidImageCount" class="text-xs text-red-600 bg-red-50 p-2 rounded">
        {{ getImageCountAdvice }}
      </div>

      <div class="flex items-center justify-between text-sm">
        <span>封面图片</span>
        <span :class="getCoverStatusClass">
          {{ getCoverStatusText }}
        </span>
      </div>
    </div>

    <!-- 导出按钮 -->
    <button
      type="button"
      :disabled="!store.canExport || isExporting"
      class="w-full btn" :class="[
        store.canExport && !isExporting
          ? 'btn-primary'
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
      ]"
      @click="startExport"
    >
      {{ isExporting ? '导出中...' : '开始导出' }}
    </button>

    <!-- 导出进度 -->
    <div v-if="isExporting" class="mt-4">
      <div class="bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${exportProgress}%` }"
        />
      </div>
      <p class="text-sm text-gray-600 mt-2 text-center">{{ exportStatus }}</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="exportError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-center">
        <svg class="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icons.warning" />
        </svg>
        <div class="flex-1">
          <h4 class="text-sm font-medium text-red-800">导出失败</h4>
          <p class="text-sm text-red-700 mt-1">{{ exportError }}</p>
        </div>
        <button
          type="button"
          class="text-red-500 hover:text-red-700"
          @click="clearError"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useStickerStore } from '@/stores/stickerStore';
import type { ExportFormat } from '@/types';
import { exportStickerPack } from '@/utils/exporter';
import { icons } from '@/utils/icons';

const store = useStickerStore();
const isExporting = ref(false);
const exportProgress = ref(0);
const exportStatus = ref('');
const exportError = ref<string | null>(null);

const minCount = computed(() => store.currentFormat?.requirements.minCount ?? store.currentFormat?.requirements.count);
const maxCount = computed(() => store.currentFormat?.requirements.maxCount ?? store.currentFormat?.requirements.count);
const fixedCount = computed(() => store.currentFormat?.requirements.count);
const allowVariable = computed(() => store.currentFormat?.requirements.allowVariable);

// 计算封面状态
const getCoverStatusText = computed(() => {
  const format = store.currentFormat;
  const isRequired = format?.requirements.coverRequired ?? false;
  const hasCover = store.coverImage !== null;

  if (hasCover) {
    return '已设置';
  }

  return isRequired ? '必需' : '可选';
});

const getCoverStatusClass = computed(() => {
  const format = store.currentFormat;
  const isRequired = format?.requirements.coverRequired ?? false;
  const hasCover = store.coverImage !== null;

  if (hasCover) {
    return 'text-green-600';
  }

  return isRequired ? 'text-red-600' : 'text-yellow-600';
});

// 计算图片数量状态
const getImageCountStatusText = computed(() => {
  const current = store.images.length;
  const format = store.currentFormat;
  if (!format) return '';
  const { allowVariable, minCount, maxCount, count } = format.requirements;
  if (!allowVariable) {
    return `${current}/${count}`;
  }
  const min = minCount ?? count;
  const max = maxCount ?? count;
  const status = `${current}/${min}~${max}`;
  return status;
});

const getImageCountStatusClass = computed(() => {
  return store.isValidImageCount ? 'text-green-600' : 'text-red-600';
});

const getImageCountAdvice = computed(() => {
  const current = store.images.length;
  const format = store.currentFormat;

  if (!format) return '';

  const required = format.requirements.count;
  const { allowVariable } = format.requirements;
  const minCount = format.requirements.minCount ?? required;
  const maxCount = format.requirements.maxCount ?? required;

  if (allowVariable) {
    if (current < minCount) {
      return `请至少上传 ${minCount - current} 张图片`;
    } else if (current > maxCount) {
      return `请删除 ${current - maxCount} 张图片，最多允许 ${maxCount} 张`;
    }
  } else {
    if (current < required) {
      return `请再上传 ${required - current} 张图片`;
    } else if (current > required) {
      return `请删除 ${current - required} 张图片，需要恰好 ${required} 张`;
    }
  }

  return '';
});

async function startExport(): Promise<void> {
  if (!store.canExport) return;

  isExporting.value = true;
  exportProgress.value = 0;
  exportStatus.value = '准备导出...';
  exportError.value = null; // 清除之前的错误

  try {
    await exportStickerPack(
      store.images,
      store.coverImage,
      store.currentFormat as ExportFormat,
      (progress, status) => {
        exportProgress.value = progress;
        exportStatus.value = status;
      },
    );

    exportStatus.value = '导出完成！';

    // 成功后自动清理
    new Promise(resolve => {
      window.setTimeout(resolve, 2000);
    }).then(() => {
      isExporting.value = false;
      exportProgress.value = 0;
      exportStatus.value = '';
    });
  } catch (error) {
    console.error('Export failed:', error);
    isExporting.value = false;
    exportProgress.value = 0;
    exportStatus.value = '';

    // 设置用户友好的错误信息
    if (error instanceof Error) {
      const errorMessage = error.message;
      if (errorMessage.includes('name')) {
        exportError.value = '图片名称不符合要求，请检查图片名称格式';
      } else if (errorMessage.includes('size') || errorMessage.includes('resize')) {
        exportError.value = '图片处理失败，可能是图片文件损坏或格式不支持';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        exportError.value = '网络错误，请检查网络连接后重试';
      } else if (errorMessage.includes('memory') || errorMessage.includes('quota')) {
        exportError.value = '内存不足或存储空间不够，请关闭其他应用后重试';
      } else {
        exportError.value = `导出失败: ${errorMessage}`;
      }
    } else {
      exportError.value = '导出过程中发生未知错误，请重试';
    }
  }
}

function clearError(): void {
  exportError.value = null;
}
</script>
