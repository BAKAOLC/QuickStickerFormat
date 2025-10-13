<template>
  <div class="card">
    <h2 class="text-lg font-medium text-gray-900 mb-4">封面设置</h2>

    <!-- 封面预览区域 - 降低高度 -->
    <div class="mb-4 h-40">
      <!-- 有封面时显示预览 -->
      <div v-if="store.coverImage" class="relative h-full">
        <img
          :src="store.coverImage.preview"
          alt="封面预览"
          class="w-full h-full object-contain bg-gray-50 rounded-lg border"
        >
        <button
          type="button"
          class="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 transition-colors"
          @click="removeCover"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 没有封面时显示上传区域 -->
      <div
        v-else
        class="h-full border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
               flex flex-col justify-center"
        :class="[
          isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        ]"
        @click="triggerFileSelect"
        @drop="onDrop"
        @dragover.prevent
        @dragenter.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
      >
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileSelect"
        >

        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>

        <p class="text-sm text-gray-600">点击上传封面图片</p>
        <p class="text-xs text-gray-500 mt-1">推荐 {{ coverImageSize }} 尺寸</p>
      </div>
    </div>

    <!-- 从表情包选择 -->
    <div v-if="store.images.length > 0" class="mt-4">
      <p class="text-sm font-medium text-gray-700 mb-2">或从表情包中选择：</p>
      <div class="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
        <div
          v-for="image in store.images"
          :key="image.id"
          class="aspect-square border-2 border-gray-200 rounded-lg overflow-hidden
                 hover:border-blue-400 transition-colors group relative"
        >
          <div class="relative w-full h-full">
            <img
              :src="image.preview"
              :alt="image.name"
              class="w-full h-full object-cover cursor-pointer"
              @click="selectFromStickers(image)"
            >
            <!-- 帧选择按钮 -->
            <button
              v-if="hasMultipleFrames(image)"
              type="button"
              class="absolute top-1 right-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded
                     opacity-0 group-hover:opacity-100 transition-opacity"
              @click="openFrameSelector(image)"
            >
              选帧
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 帧选择器 -->
  <FrameSelector
    :show="showFrameSelector"
    :frame-count="currentImage?.frameCount || 10"
    :initial-frame="currentImage?.selectedFrame || 0"
    :image="currentImage"
    @confirm="handleFrameSelect"
    @close="showFrameSelector = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import FrameSelector from './FrameSelector.vue';

import { useStickerStore } from '@/stores/stickerStore';
import type { StickerImage } from '@/types';

const store = useStickerStore();
const fileInput = ref<HTMLInputElement>();
const isDragOver = ref(false);
const showFrameSelector = ref(false);
const currentImage = ref<StickerImage>();

const coverImageSize = computed(() => {
  const width = store.currentFormat?.cover?.width ?? 200;
  const height = store.currentFormat?.cover?.height ?? 200;
  return `${width}x${height}`;
});

function triggerFileSelect(): void {
  fileInput.value?.click();
}

function onFileSelect(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.files?.[0]) {
    handleFile(target.files[0]);
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  isDragOver.value = false;

  const file = event.dataTransfer?.files?.[0];
  if (file) {
    handleFile(file);
  }
}

function handleFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    // 这里应该用更好的提示方式替代alert
    console.warn('请选择有效的图片文件');
    return;
  }

  const preview = URL.createObjectURL(file);
  store.setCoverImage({
    file,
    preview,
    fromStickers: false,
  });
}

function selectFromStickers(image: StickerImage): void {
  // 对于动图，需要使用选定的帧来生成封面
  if (hasMultipleFrames(image)) {
    // 对于动图，使用图片处理工具来提取指定帧
    generateCoverFromFrame(image, image.selectedFrame ?? 0);
  } else {
    // 对于静态图片，直接使用预览图
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 200;
      canvas.height = 200;

      if (ctx) {
        ctx.drawImage(img, 0, 0, 200, 200);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `cover-${image.name}.png`, { type: 'image/png' });
            const preview = URL.createObjectURL(blob);

            store.setCoverImage({
              file,
              preview,
              fromStickers: true,
              sourceImageId: image.id,
            });
          }
        }, 'image/png');
      }
    };

    img.src = image.preview;
  }
}

async function generateCoverFromFrame(image: StickerImage, frameIndex: number): Promise<void> {
  try {
    // 使用ImageProcessor来提取指定帧
    const { ImageProcessor } = await import('@/utils/imageProcessor');

    const result = await ImageProcessor.extractFrameAsCover(
      image.file,
      frameIndex,
      { width: 200, height: 200 },
    );

    const file = new File([result.blob], `cover-${image.name}-frame${frameIndex + 1}.png`, {
      type: 'image/png',
    });

    store.setCoverImage({
      file,
      preview: result.preview,
      fromStickers: true,
      sourceImageId: image.id,
    });
  } catch (error) {
    console.error('生成封面失败:', error);
    // 如果提取失败，降级到使用预览图
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 200;
      canvas.height = 200;

      if (ctx) {
        ctx.drawImage(img, 0, 0, 200, 200);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `cover-${image.name}-fallback.png`, { type: 'image/png' });
            const preview = URL.createObjectURL(blob);

            store.setCoverImage({
              file,
              preview,
              fromStickers: true,
              sourceImageId: image.id,
            });
          }
        }, 'image/png');
      }
    };

    img.src = image.preview;
  }
}

function removeCover(): void {
  store.removeCoverImage();
}

function hasMultipleFrames(image: StickerImage): boolean {
  return (image.frameCount ?? 1) > 1;
}

function openFrameSelector(image: StickerImage): void {
  currentImage.value = image;
  showFrameSelector.value = true;
}

function handleFrameSelect(frameIndex: number): void {
  if (currentImage.value) {
    generateCoverFromFrame(currentImage.value, frameIndex);
  }
  showFrameSelector.value = false;
}
</script>
