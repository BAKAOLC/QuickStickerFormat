<template>
  <div class="card">
    <h2 class="text-lg font-medium text-gray-900 mb-4">上传表情包</h2>

    <!-- 拖拽上传区域 -->
    <div
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @click="triggerFileSelect"
      @drop="onDrop"
      @dragover.prevent
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,.gif"
        class="hidden"
        @change="onFileSelect"
      >

      <div class="space-y-2">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div class="text-sm text-gray-600">
          <span class="font-medium text-blue-600">
            点击选择文件
          </span>
          或拖拽图片到此处
        </div>
        <p class="text-xs text-gray-500">
          支持 PNG, JPG, GIF 格式，推荐使用动态 GIF
        </p>
      </div>
    </div>

    <!-- 批量操作 -->
    <div v-if="store.images.length > 0" class="mt-4 flex justify-between items-center">
      <span class="text-sm text-gray-600">
        已选择 {{ store.images.length }} 张图片
      </span>
      <button
        type="button"
        class="btn-danger text-sm"
        @click="clearAll"
      >
        清空所有
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { useStickerStore } from '@/stores/stickerStore';

const store = useStickerStore();
const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);

function triggerFileSelect(): void {
  fileInput.value?.click();
}

async function onFileSelect(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    await handleFiles(Array.from(target.files));
    target.value = '';
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault();
  isDragOver.value = false;

  if (event.dataTransfer?.files) {
    await handleFiles(Array.from(event.dataTransfer.files));
  }
}

async function handleFiles(files: File[]): Promise<void> {
  // 过滤图片文件
  const imageFiles = files.filter(file => file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.gif'));

  if (imageFiles.length === 0) {
    console.warn('请选择有效的图片文件');
    return;
  }

  // 允许上传，但给出数量提醒
  // 移除未使用的 currentCount 变量
  await store.addImages(imageFiles);
}

function clearAll(): void {
  // eslint-disable-next-line no-alert
  if (confirm('确定要清空所有图片吗？')) {
    store.clearAll();
  }
}
</script>
