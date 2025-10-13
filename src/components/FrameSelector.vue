<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden"
    @click="closeModal"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full mx-4 flex flex-col"
      style="width: 800px; height: 600px;"
      @click.stop
    >
      <!-- 标题栏 -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        <h3 class="text-lg font-medium text-gray-900">选择预览帧</h3>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          @click="closeModal"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 加载状态 -->
        <div v-if="loading" class="flex items-center justify-center flex-1 p-8">
          <div class="flex items-center space-x-3">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <div class="text-gray-600">{{ loadingStatus }}</div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="flex items-center justify-center flex-1 p-8">
          <div class="text-center">
            <div class="text-red-500 mb-4">{{ error }}</div>
            <button
              type="button"
              class="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
              @click="retryExtraction"
            >
              重试
            </button>
          </div>
        </div>

        <!-- 帧列表 -->
        <div v-else class="flex-1 overflow-hidden">
          <div class="h-full p-4 overflow-y-auto">
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            <div
              v-for="(frameData, index) in frameImages"
              :key="index"
              class="aspect-square border-2 rounded-lg overflow-hidden cursor-pointer
                     transition-all duration-200 hover:shadow-md"
              :class="[
                selectedFrame === index
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300',
                image && image.selectedFrame === index
                  ? 'bg-green-50'
                  : 'bg-gray-50'
              ]"
              @click="selectFrame(index)"
            >
              <div class="w-full h-full flex flex-col relative">
                <!-- 图片预览 -->
                <div class="flex-1 flex items-center justify-center p-1">
                  <img
                    v-if="frameData"
                    :src="frameData"
                    :alt="`第 ${index + 1} 帧`"
                    class="max-w-full max-h-full object-contain"
                  >
                  <div v-else class="text-xs text-gray-400">加载中...</div>
                </div>

                <!-- 帧序号 -->
                <div class="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                  {{ index + 1 }}
                </div>

                <!-- 当前标记 -->
                <div
                  v-if="image && image.selectedFrame === index"
                  class="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded"
                >
                  当前
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end space-x-3 p-4 border-t border-gray-200 flex-shrink-0">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
          @click="closeModal"
        >
          取消
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                 disabled:bg-gray-400 disabled:cursor-not-allowed"
          :disabled="loading || !!error"
          @click="confirmSelection"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import type { StickerImage } from '@/types';
import { ImageProcessor } from '@/utils/imageProcessor';

interface Props {
  show: boolean;
  frameCount: number;
  initialFrame?: number;
  image?: StickerImage | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'confirm', frameIndex: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  initialFrame: 0,
  image: null,
});

const emit = defineEmits<Emits>();

const selectedFrame = ref(props.initialFrame);
const loading = ref(false);
const loadingStatus = ref('');
const error = ref<string | null>(null);
const frameImages = ref<string[]>([]);

watch(() => props.show, (newShow) => {
  if (newShow) {
    selectedFrame.value = props.initialFrame;
    extractFrames();
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
  } else {
    // 恢复背景滚动
    document.body.style.overflow = '';
  }
});

async function extractFrames(): Promise<void> {
  if (!props.image) {
    return;
  }

  loading.value = true;
  error.value = null;
  frameImages.value = [];
  loadingStatus.value = '正在解析图像...';

  try {
    const isAnimated = await ImageProcessor.isAnimatedImage(props.image.file);

    if (!isAnimated) {
      // 静态图像
      frameImages.value = [props.image.preview];
      loadingStatus.value = '';
    } else if (props.image.file.type === 'image/gif') {
      await extractGifFrames();
    } else {
      // 其他格式，降级到显示原图
      frameImages.value = [props.image.preview];
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '提取帧失败';
  } finally {
    loading.value = false;
    loadingStatus.value = '';
  }
}

async function extractGifFrames(): Promise<void> {
  if (!props.image) return;

  loadingStatus.value = '正在解析GIF帧...';

  try {
    const frames = await ImageProcessor.extractGifFrames(props.image.file);

    if (frames.length === 0) {
      throw new Error('未找到任何帧');
    }

    // 将ImageData转换为DataURL
    const frameUrls: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      const blob = await ImageProcessor.createBlobFromImageData(frame.data, 'png');
      const url = URL.createObjectURL(blob);
      frameUrls.push(url);
    }

    frameImages.value = frameUrls;
  } catch (err) {
    throw new Error(`无法解析GIF文件: ${err instanceof Error ? err.message : '未知错误'}`);
  }
}

function selectFrame(frameIndex: number): void {
  selectedFrame.value = frameIndex;
}

function confirmSelection(): void {
  emit('confirm', selectedFrame.value);
  closeModal();
}

function closeModal(): void {
  // 清理URL对象
  frameImages.value.forEach(url => URL.revokeObjectURL(url));
  frameImages.value = [];
  // 恢复背景滚动
  document.body.style.overflow = '';
  emit('close');
}

function retryExtraction(): void {
  extractFrames();
}
</script>
