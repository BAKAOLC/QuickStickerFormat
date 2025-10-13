/**
 * 导出工具类
 * 处理表情包的导出逻辑
 */

import JSZip from 'jszip';

import { ImageProcessor } from './imageProcessor';

import type { CoverImage, ExportFormat, OutputFormat, StickerImage } from '@/types';

export interface ExportProgress {
  progress: number;
  status: string;
}

export class StickerExporter {
  /**
   * 导出表情包
   */
  static async exportStickerPack(
    images: StickerImage[],
    coverImage: CoverImage | null,
    format: ExportFormat,
    onProgress?: (progress: number, status: string) => void,
  ): Promise<void> {
    try {
      onProgress?.(0, '开始导出...');

      // 验证输入
      this.validateInput(images, coverImage, format);

      // 处理每个输出格式的图片 - 每个格式生成独立的ZIP文件
      const totalFormats = format.outputs.length;
      const progressPerFormat = 70 / totalFormats;

      // 处理输出格式
      for (let i = 0; i < format.outputs.length; i++) {
        const output = format.outputs[i];
        const baseProgress = 10 + (i * progressPerFormat);
        onProgress?.(baseProgress, `处理${output.name}...`);

        // 为每个输出创建独立的ZIP
        const outputZip = new JSZip();
        await this.processImagesForOutput(outputZip, images, output, baseProgress, progressPerFormat, onProgress);

        // 生成ZIP文件名
        const zipFilename = output.zipFilename
          ? ImageProcessor.generateFileName(output.zipFilename, images[0]?.name || 'stickers', 1)
          : `${output.id}.zip`;

        // 生成并下载ZIP文件
        const zipBlob = await outputZip.generateAsync({ type: 'blob' });
        this.downloadFile(zipBlob, zipFilename);
      }

      // 处理封面图 - 直接下载
      if (coverImage && format.cover) {
        onProgress?.(80, '处理封面图...');
        const processedCover = await this.processSingleCover(coverImage, format.cover);
        this.downloadFile(processedCover.blob, format.cover.filename);
      }

      onProgress?.(100, '导出完成！');
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * 验证输入
   */
  private static validateInput(
    images: StickerImage[],
    coverImage: CoverImage | null,
    format: ExportFormat,
  ): void {
    // 检查图片数量
    if (!this.isValidImageCount(images.length, format)) {
      throw new Error(`图片数量不符合要求：需要${format.requirements.count}张，当前${images.length}张`);
    }

    // 检查封面
    if (format.requirements.coverRequired && !coverImage) {
      throw new Error('需要设置封面图片');
    }

    // 检查图片名称
    for (const image of images) {
      const validationRule = format.validation?.nameValidation;
      if (!ImageProcessor.validateImageName(image.name, validationRule)) {
        throw new Error(`图片名称"${image.name}"不符合要求：只允许中英文，最多4个汉字`);
      }
    }
  }

  /**
   * 检查图片数量是否有效
   */
  private static isValidImageCount(count: number, format: ExportFormat): boolean {
    const { requirements } = format;

    if (requirements.allowVariable) {
      const minCount = requirements.minCount ?? 1;
      const maxCount = requirements.maxCount ?? 999;
      return count >= minCount && count <= maxCount;
    }

    return count === requirements.count;
  }

  /**
   * 处理单个输出格式的图片到独立的ZIP
   */
  private static async processImagesForOutput(
    zip: JSZip,
    images: StickerImage[],
    outputFormat: OutputFormat,
    baseProgress: number,
    progressRange: number,
    onProgress?: (progress: number, status: string) => void,
  ): Promise<void> {
    const { width, height, format } = outputFormat;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const progress = baseProgress + (i / images.length) * progressRange;
      onProgress?.(progress, `处理${outputFormat.name} ${i + 1}/${images.length}`);

      try {
        let processedImage;

        // 检查是否为动态图像
        const isAnimated = await ImageProcessor.isAnimatedImage(image.file);

        // 判断输出格式和源图像类型
        if (isAnimated && (format === 'gif' || format === 'webp')) {
          // 如果是动态图像且目标格式支持动画（gif或webp），则保留动画效果
          // 注意：此处需要在ImageProcessor中实现resizeAnimatedImage方法
          processedImage = await ImageProcessor.resizeImage(image.file, {
            width,
            height,
            format: format,
            quality: 0.9,
            preserveAnimation: true, // 新增参数，表示保留动画
          });
        } else if (isAnimated && image.selectedFrame !== undefined) {
          // 如果是动态图像但输出格式是静态的（如png、jpeg），则使用用户选择的帧
          processedImage = await this.processSpecificFrame(
            image,
            image.selectedFrame,
            width,
            height,
            format as 'png' | 'jpeg' | 'webp' | 'gif',
          );
        } else {
          // 处理静态图像
          processedImage = await ImageProcessor.resizeImage(image.file, {
            width,
            height,
            format: format as 'png' | 'jpeg' | 'webp' | 'gif',
            quality: 0.9,
          });
        }

        // 生成文件名
        const fileName = ImageProcessor.generateFileName(
          outputFormat.filename,
          image.name,
          i + 1,
        );

        // 添加到ZIP - 直接添加到根目录，不创建子文件夹
        zip.file(fileName, processedImage.blob);
      } catch (error) {
        console.error(`Failed to process ${outputFormat.name} ${i + 1}:`, error);
        throw new Error(`处理第${i + 1}张${outputFormat.name}失败`);
      }
    }
  }

  /**
   * 处理动态图像的指定帧
   * 从动态图像中提取特定帧，并调整尺寸
   */
  private static async processSpecificFrame(
    image: StickerImage,
    frameIndex: number,
    width: number,
    height: number,
    format: 'png' | 'jpeg' | 'webp' | 'gif',
  ): Promise<{ blob: Blob; type: string; width: number; height: number }> {
    try {
      // 提取帧
      let frames;
      if (image.file.type === 'image/gif') {
        frames = await ImageProcessor.extractGifFrames(image.file);
      } else {
        throw new Error('不支持的动态图像格式');
      }

      // 检查帧索引是否有效
      if (frameIndex >= frames.length) {
        console.warn(`帧索引超出范围: ${frameIndex} >= ${frames.length}，使用第一帧`);
        frameIndex = 0;
      }

      // 获取指定帧
      const frame = frames[frameIndex];

      // 创建临时画布调整尺寸
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建Canvas上下文');

      canvas.width = width;
      canvas.height = height;

      // 创建临时画布以处理ImageData
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('无法创建临时Canvas上下文');

      // 设置临时画布尺寸为原始帧尺寸
      tempCanvas.width = frame.data.width;
      tempCanvas.height = frame.data.height;

      // 将帧数据绘制到临时画布
      tempCtx.putImageData(frame.data, 0, 0);

      // 将临时画布内容缩放并绘制到主画布
      ctx.drawImage(tempCanvas, 0, 0, width, height);

      // 转换为指定格式的Blob
      const mimeType = ImageProcessor.getMimeType(format);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => {
          if (b) resolve(b);
          else reject(new Error('图像转换失败'));
        }, mimeType, 0.9);
      });

      return {
        blob,
        type: mimeType,
        width,
        height,
      };
    } catch (error) {
      console.error('处理动态图像帧失败:', error);
      throw new Error('处理动态图像帧失败');
    }
  }

  /**
   * 处理单个封面图并返回处理后的图像
   */
  private static async processSingleCover(
    coverImage: CoverImage,
    coverConfig: {
      width: number;
      height: number;
      format: string;
      filename: string;
    },
  ): Promise<{ blob: Blob; type: string; width: number; height: number }> {
    const { width, height, format: outputFormat } = coverConfig;

    try {
      // 调整封面图尺寸
      return await ImageProcessor.resizeImage(coverImage.file, {
        width,
        height,
        format: outputFormat as 'png' | 'jpeg' | 'webp',
        quality: 0.9,
      });
    } catch (error) {
      console.error('Failed to process cover:', error);
      throw new Error('处理封面图失败');
    }
  }

  /**
   * 下载文件
   */
  private static downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * 导出函数（兼容现有代码）
 */
export async function exportStickerPack(
  images: StickerImage[],
  coverImage: CoverImage | null,
  format: ExportFormat,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> {
  return StickerExporter.exportStickerPack(images, coverImage, format, onProgress);
}
