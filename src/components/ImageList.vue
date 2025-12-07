<template>
  <div class="card">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-medium text-gray-900">表情包列表</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="store.images.length > 0"
          type="button"
          class="btn-danger text-sm"
          @click="clearAll"
        >
          清空所有
        </button>
        <button
          type="button"
          class="btn-primary text-sm"
          @click="triggerFileSelect"
        >
          上传表情包
        </button>
      </div>
    </div>

    <!-- 表情包网格或空状态提示 -->
    <div
      ref="listContainer"
      class="h-96 overflow-y-auto bg-gray-50 relative"
      @drop="onDrop"
      @dragover.prevent
      @dragenter.prevent="handleDragEnter"
      @dragleave.prevent="handleDragLeave"
    >
      <!-- 拖拽上传覆盖层 -->
      <div
        v-if="isDragOver"
        class="absolute inset-0 z-50 bg-blue-50 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center"
      >
        <div class="text-center space-y-2">
          <svg class="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div class="text-sm font-medium text-blue-600">
            松开鼠标上传图片
          </div>
          <p class="text-xs text-gray-500">
            支持 PNG, JPG, GIF 格式，推荐使用动态 GIF
          </p>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,.gif"
        class="hidden"
        @change="onFileSelect"
      >
      <!-- 空状态提示 -->
      <div
        v-if="store.images.length === 0"
        class="h-full flex flex-col items-center justify-center text-center text-gray-500"
      >
        <div class="w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center mb-4">
          <span class="text-gray-400 text-xl">📷</span>
        </div>
        <p class="text-sm font-medium text-gray-600">还没有上传表情包</p>
        <p class="text-xs text-gray-400 mt-1">点击上方按钮或拖拽图片到此处上传</p>
      </div>

      <!-- 表情包网格 -->
      <draggable
        v-model="localImages"
        item-key="id"
        handle=".drag-handle"
        class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-3 content-start"
        @end="onDragEnd"
      >
      <template #item="{ element }">
  <div class="image-card group" :class="{ 'border-2 border-yellow-500': store.duplicateNames.includes(element.id) }">
          <!-- 序号拖拽手柄 - 独立在外面 -->
          <div class="drag-handle">
            {{ element.order + 1 }}
          </div>

          <!-- 图片预览容器 -->
          <div class="image-preview-container">
            <!-- 图片预览 -->
            <div class="image-preview">
              <img
                :src="element.preview"
                :alt="element.name"
                class="max-w-full max-h-full object-contain"
              >
              <!-- 删除按钮遮罩 - 只遮盖图片 -->
              <div class="delete-overlay">
                <button
                  type="button"
                  class="delete-button-center"
                  @click="removeImage(element.id)"
                >
                  <div class="delete-icon">
                    ×
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- 名称输入和帧选择 -->
          <div class="image-controls">
            <input
              v-model="element.name"
              type="text"
              class="image-name-input"
              placeholder="表情名称"
              @blur="updateImageName(element.id, element.name)"
            >

            <!-- GIF/WebP 帧选择器 -->
            <div class="frame-selector">
              <label class="text-xs text-gray-600 shrink-0">预览帧:</label>
              <button
                type="button"
                class="frame-selector-select text-left"
                :disabled="element.frameCount <= 1"
                :class="{ 'opacity-50 cursor-not-allowed': element.frameCount <= 1 }"
                @click="openFrameSelector(element)"
              >
                {{ (element.selectedFrame ?? 0) + 1 }}
              </button>
            </div>
          </div>
        </div>
      </template>
      </draggable>
    </div>

    <!-- 帧选择弹窗 -->
    <FrameSelector
      :show="showFrameSelector"
      :image="selectedImageForFrames"
      :frame-count="selectedImageFrameCount"
      :initial-frame="selectedImageCurrentFrame"
      @close="closeFrameSelector"
      @confirm="confirmFrameSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import draggable from 'vuedraggable';

import FrameSelector from '@/components/FrameSelector.vue';
import { useStickerStore } from '@/stores/stickerStore';
import type { StickerImage } from '@/types';
import { ImageProcessor } from '@/utils/imageProcessor';

const store = useStickerStore();

// 上传相关状态
const fileInput = ref<HTMLInputElement>();
const listContainer = ref<HTMLElement>();
const isDragOver = ref(false);

// 帧选择相关状态
const showFrameSelector = ref(false);
const selectedImageForFrames = ref<StickerImage | null>(null);
const selectedImageFrameCount = ref(10);
const selectedImageCurrentFrame = ref(0);

const localImages = computed({
  get: () => store.images,
  set: (value) => {
    store.reorderImages(value);
  },
});

function removeImage(id: string): void {
  store.removeImage(id);
}

function updateImageName(id: string, name: string): void {
  store.updateImageName(id, name);
}

function onDragEnd(): void {
  // vuedraggable 会自动更新 localImages，这会触发 set 方法
}

async function hasMultipleFrames(image: StickerImage): Promise<boolean> {
  try {
    return await ImageProcessor.isAnimatedImage(image.file);
  } catch {
    return false;
  }
}

async function openFrameSelector(image: StickerImage): Promise<void> {
  const isAnimated = await hasMultipleFrames(image);
  if (!isAnimated) return;

  selectedImageForFrames.value = image;
  selectedImageFrameCount.value = 1; // 实际帧数会在FrameSelector中动态获取
  selectedImageCurrentFrame.value = image.selectedFrame ?? 0;
  showFrameSelector.value = true;
}

function closeFrameSelector(): void {
  showFrameSelector.value = false;
  selectedImageForFrames.value = null;
}

function confirmFrameSelection(frameIndex: number): void {
  if (selectedImageForFrames.value) {
    store.updateImageFrame(selectedImageForFrames.value.id, frameIndex);
  }
  closeFrameSelector();
}

// 上传相关函数
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

function handleDragEnter(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true;
  }
}

function handleDragLeave(event: DragEvent): void {
  event.preventDefault();
  // 只有当离开的是容器本身时才隐藏覆盖层（避免子元素触发）
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  if (!listContainer.value?.contains(relatedTarget)) {
    isDragOver.value = false;
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

  await store.addImages(imageFiles);
}

function clearAll(): void {
  // eslint-disable-next-line no-alert
  if (confirm('确定要清空所有图片吗？')) {
    store.clearAll();
  }
}
</script>
