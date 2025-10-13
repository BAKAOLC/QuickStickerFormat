import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AppSettings, CoverImage, ExportFormat, StickerImage } from '@/types';
import { ImageProcessor } from '@/utils/imageProcessor';

export const useStickerStore = defineStore('sticker', () => {
  // State
  const images = ref<StickerImage[]>([]);
  const coverImage = ref<CoverImage | null>(null);
  const settings = ref<AppSettings>({
    selectedFormat: 'qq',
  });

  // Export formats
  const exportFormats = ref<Record<string, ExportFormat>>({
    qq: {
      id: 'qq',
      name: 'QQ 表情包',
      description: 'QQ 平台专用格式，需要 16 张表情',
      requirements: {
        count: 16,
        minCount: 16,
        maxCount: 16,
        allowVariable: false,
        coverRequired: true,
      },
      outputs: [
        {
          id: 'stickers',
          name: '表情包',
          width: 300,
          height: 300,
          format: 'gif',
          filename: '{name}_{index:02d}.gif',
          zipFilename: 'stickers.zip',
        },
        {
          id: 'preview',
          name: '预览图',
          width: 300,
          height: 300,
          format: 'png',
          filename: '{name}_{index:02d}.png',
          zipFilename: 'preview.zip',
        },
      ],
      cover: {
        width: 200,
        height: 200,
        format: 'png',
        filename: 'cover.png',
      },
      validation: {
        nameValidation: {
          maxLength: 8,
          allowedChars: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,
        },
      },
    },
  });

  // Computed
  const currentFormat = computed(() => exportFormats.value[settings.value.selectedFormat]);

  const isValidImageCount = computed(() => {
    const format = currentFormat.value;
    if (!format) return false;

    const count = images.value.length;
    if (format.requirements.allowVariable) {
      return count >= (format.requirements.minCount ?? 1)
        && count <= (format.requirements.maxCount ?? 999);
    }
    return count === format.requirements.count;
  });

  const canExport = computed(() => {
    const format = currentFormat.value;
    const needsCover = format?.requirements.coverRequired ?? false;

    return isValidImageCount.value
      && (!needsCover || coverImage.value !== null);
  });

  // Actions
  async function addImages(files: File[]): Promise<void> {
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const id = `${Date.now()}-${index}`;
      const preview = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '');

      // 检测是否为动态图像
      let frameCount = 1;
      try {
        const isAnimated = await ImageProcessor.isAnimatedImage(file);
        if (isAnimated) {
          if (file.type === 'image/gif') {
            const frames = await ImageProcessor.extractGifFrames(file);
            frameCount = frames.length;
          }
        }
      } catch (error) {
        console.warn('Failed to detect frame count for', file.name, error);
      }

      images.value.push({
        id,
        file,
        name,
        preview,
        order: images.value.length,
        selectedFrame: 0,
        frameCount,
      });
    }
  }

  function removeImage(id: string): void {
    const index = images.value.findIndex(img => img.id === id);
    if (index !== -1) {
      URL.revokeObjectURL(images.value[index].preview);
      images.value.splice(index, 1);

      // 重新排序
      images.value.forEach((img, idx) => {
        img.order = idx;
      });
    }
  }

  function updateImageName(id: string, name: string): void {
    const image = images.value.find(img => img.id === id);
    if (image) {
      image.name = name;
    }
  }

  function updateImageFrame(id: string, frameIndex: number): void {
    const image = images.value.find(img => img.id === id);
    if (image) {
      image.selectedFrame = frameIndex;
    }
  }

  function reorderImages(newOrder: StickerImage[]): void {
    images.value = newOrder.map((img, index) => ({
      ...img,
      order: index,
    }));
  }

  function setCoverImage(image: CoverImage): void {
    if (coverImage.value?.preview) {
      URL.revokeObjectURL(coverImage.value.preview);
    }
    coverImage.value = image;
  }

  function removeCoverImage(): void {
    if (coverImage.value?.preview) {
      URL.revokeObjectURL(coverImage.value.preview);
    }
    coverImage.value = null;
  }

  function updateSettings(newSettings: Partial<AppSettings>): void {
    settings.value = { ...settings.value, ...newSettings };
  }

  function clearAll(): void {
    images.value.forEach(img => URL.revokeObjectURL(img.preview));
    images.value = [];
    removeCoverImage();
  }

  return {
    // State
    images,
    coverImage,
    settings,
    exportFormats,

    // Computed
    currentFormat,
    isValidImageCount,
    canExport,

    // Actions
    addImages,
    removeImage,
    updateImageName,
    updateImageFrame,
    reorderImages,
    setCoverImage,
    removeCoverImage,
    updateSettings,
    clearAll,
  };
});
