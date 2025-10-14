<template>
  <div class="card">
    <h2 class="text-lg font-medium text-gray-900 mb-4">表情包列表</h2>

    <!-- 表情包网格或空状态提示 -->
    <div class="h-96 overflow-y-auto bg-gray-50">
      <!-- 空状态提示 -->
      <div
        v-if="store.images.length === 0"
        class="h-full flex flex-col items-center justify-center text-center text-gray-500"
      >
        <div class="w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center mb-4">
          <span class="text-gray-400 text-xl">📷</span>
        </div>
        <p class="text-sm font-medium text-gray-600">还没有上传表情包</p>
        <p class="text-xs text-gray-400 mt-1">请在下方上传区域添加图片</p>
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
</script>
