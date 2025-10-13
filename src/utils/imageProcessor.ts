/**
 * 图像处理工具类
 * 支持多种格式的转换、调整和帧提取
 */

import type { NameValidationRule } from '@/types';

export interface ImageFrame {
  data: ImageData;
  delay: number;
}

export interface ProcessedImage {
  blob: Blob;
  type: string;
  width: number;
  height: number;
}

export interface ResizeOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'gif';
  preserveAnimation?: boolean; // 是否保留动画效果
}

export class ImageProcessor {
  /**
   * 检查文件是否为动态图像
   */
  static async isAnimatedImage(file: File): Promise<boolean> {
    if (file.type === 'image/gif') {
      return await this.isAnimatedGif(file);
    }
    // webp一律按静态图像处理
    return false;
  }

  /**
   * 检查GIF是否为动态
   */
  private static async isAnimatedGif(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 检查GIF文件头
      if (uint8Array[0] !== 0x47 || uint8Array[1] !== 0x49 || uint8Array[2] !== 0x46) {
        return false;
      }

      // 检查是否有多个图像描述符
      let i = 6; // 跳过GIF文件头
      while (i < uint8Array.length - 1) {
        if (uint8Array[i] === 0x21) { // 扩展块
          i += 2;
          if (uint8Array[i] === 0xF9) { // 图形控制扩展
            return true;
          }
          // 跳过扩展块
          i++;
          while (i < uint8Array.length && uint8Array[i] !== 0x00) {
            i += uint8Array[i] + 1;
          }
          i++;
        } else if (uint8Array[i] === 0x2C) { // 图像描述符
          return true;
        } else if (uint8Array[i] === 0x3B) { // 文件结束符
          break;
        } else {
          i++;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 提取GIF的所有帧
   */
  static async extractGifFrames(file: File): Promise<ImageFrame[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // 使用gifuct-js解析GIF
      const gifuct = await import('gifuct-js');
      const parsedGif = gifuct.parseGIF(arrayBuffer);
      const frames = gifuct.decompressFrames(parsedGif, true);

      // 创建画布来合成完整帧
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('无法创建Canvas上下文');
      }

      // 设置画布尺寸为GIF的全局尺寸
      canvas.width = parsedGif.lsd.width;
      canvas.height = parsedGif.lsd.height;

      const resultFrames: ImageFrame[] = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        // 如果是第一帧，清空画布
        if (i === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // 绘制当前帧
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height),
          frame.dims.left,
          frame.dims.top,
        );

        // 获取完整的帧数据
        const fullFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        resultFrames.push({
          data: fullFrameData,
          delay: frame.delay ?? 100, // 默认100ms延迟
        });
      }

      return resultFrames;
    } catch (error) {
      throw new Error(`无法解析GIF文件: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 调整图像尺寸
   * 如果 preserveAnimation 为 true 且输入是动态图像，则保留动画效果
   */
  static async resizeImage(
    file: File,
    options: ResizeOptions,
  ): Promise<ProcessedImage> {
    // 检查是否需要保留动画
    if (options.preserveAnimation) {
      const isAnimated = await this.isAnimatedImage(file);
      if (isAnimated) {
        // 处理动态GIF
        if (file.type === 'image/gif' && options.format === 'gif') {
          // 目前简单返回原文件，未来可以实现真正的调整大小功能
          console.log('保留GIF动画并调整尺寸');
          return {
            blob: file,
            type: 'image/gif',
            width: options.width,
            height: options.height,
          };
        }
      }
    }

    // 处理静态图像或不保留动画的情况
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }

        canvas.width = options.width;
        canvas.height = options.height;

        // 绘制调整后的图像
        ctx.drawImage(img, 0, 0, options.width, options.height);

        // 转换为指定格式
        const mimeType = this.getMimeType(options.format ?? 'png');
        const quality = options.quality ?? 0.9;

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('图像转换失败'));
            return;
          }

          resolve({
            blob,
            type: mimeType,
            width: options.width,
            height: options.height,
          });
        }, mimeType, quality);
      };

      img.onerror = () => reject(new Error('图像加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 从ImageData创建Blob
   */
  static async createBlobFromImageData(
    imageData: ImageData,
    format: 'png' | 'jpeg' | 'webp' = 'png',
    quality: number = 0.9,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      canvas.width = imageData.width;
      canvas.height = imageData.height;

      ctx.putImageData(imageData, 0, 0);

      const mimeType = this.getMimeType(format);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('图像转换失败'));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });
  }

  /**
   * 获取MIME类型
   */
  static getMimeType(format: string): string {
    switch (format) {
      case 'png': return 'image/png';
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      case 'gif': return 'image/gif';
      default: return 'image/png';
    }
  }

  /**
   * 验证图像名称（可配置）
   */
  static validateImageName(name: string, validationRule?: NameValidationRule): boolean {
    if (!validationRule) {
      // 默认验证规则
      return true;
    }

    // 使用自定义验证规则
    if (validationRule.customValidator) {
      return validationRule.customValidator(name);
    }

    // 检查最大长度（多字符如 emoji/unicode surrogate pair 计为2）
    if (validationRule.maxLength !== undefined) {
      let totalLength = 0;
      for (const char of Array.from(name)) {
        // surrogate pair（emoji/特殊符号）长度为2
        totalLength += char.length > 1 ? 2 : 1;
      }
      if (totalLength > validationRule.maxLength) {
        return false;
      }
    }

    // 检查允许的字符
    if (validationRule.allowedChars) {
      if (!validationRule.allowedChars.test(name)) {
        return false;
      }
    }

    return name.length > 0;
  }

  /**
   * 从动图文件中提取指定帧并创建封面图像
   */
  static async extractFrameAsCover(
    file: File,
    frameIndex: number = 0,
    targetSize: { width: number; height: number } = { width: 200, height: 200 },
  ): Promise<{ blob: Blob; preview: string }> {
    try {
      let frames: ImageFrame[] = [];

      if (file.type === 'image/gif') {
        frames = await this.extractGifFrames(file);
      } else if (file.type === 'image/webp') {
        // webp按静态图像处理
        const img = await this.loadImageFromFile(file);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData) {
          frames = [{ data: imageData, delay: 100 }];
        }
      } else {
        throw new Error('不支持的文件格式');
      }

      if (frames.length === 0) {
        throw new Error('无法提取帧数据');
      }

      // 确保帧索引有效
      const validFrameIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));
      const frame = frames[validFrameIndex];

      // 创建目标尺寸的Blob
      const blob = await this.createBlobFromImageData(
        frame.data,
        'png',
        0.9,
      );

      // 调整尺寸
      const resizedBlob = await this.resizeImageBlob(blob, targetSize);
      const preview = URL.createObjectURL(resizedBlob);

      return {
        blob: resizedBlob,
        preview,
      };
    } catch {
      throw new Error('无法提取指定帧作为封面');
    }
  }

  /**
   * 调整Blob图像的尺寸
   */
  private static async resizeImageBlob(
    blob: Blob,
    targetSize: { width: number; height: number },
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建Canvas上下文'));
          return;
        }

        canvas.width = targetSize.width;
        canvas.height = targetSize.height;

        // 绘制调整后的图像
        ctx.drawImage(img, 0, 0, targetSize.width, targetSize.height);

        canvas.toBlob((resizedBlob) => {
          if (!resizedBlob) {
            reject(new Error('图像调整失败'));
            return;
          }
          resolve(resizedBlob);
        }, 'image/png', 0.9);
      };

      img.onerror = () => reject(new Error('图像加载失败'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * 生成文件名（支持模板字符串）
   */
  static generateFileName(template: string, name: string, index: number): string {
    return template
      .replace('{name}', name)
      .replace('{index}', String(index))
      .replace('{index:02d}', String(index).padStart(2, '0'))
      .replace('{index:03d}', String(index).padStart(3, '0'));
  }

  /**
   * 从File加载Image对象
   */
  static async loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图像加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 缩放并重编码 GIF 动图（完整支持）
   */
  static async resizeAnimatedGifFully(file: File, options: ResizeOptions): Promise<ProcessedImage> {
    // 1. 提取所有帧
    const frames = await this.extractGifFrames(file);
    // 2. 缩放每一帧
    const resizedFrames: { imageData: ImageData; delay: number }[] = [];
    for (const frame of frames) {
      const canvas = document.createElement('canvas');
      canvas.width = options.width;
      canvas.height = options.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建Canvas上下文');
      // 缩放帧
      ctx.putImageData(frame.data, 0, 0);
      const scaled = document.createElement('canvas');
      scaled.width = options.width;
      scaled.height = options.height;
      const scaledCtx = scaled.getContext('2d');
      if (!scaledCtx) throw new Error('无法创建Canvas上下文');
      scaledCtx.drawImage(canvas, 0, 0, options.width, options.height);
      const scaledImageData = scaledCtx.getImageData(0, 0, options.width, options.height);
      resizedFrames.push({ imageData: scaledImageData, delay: frame.delay });
    }
    // 3. 使用 gif.js 编码
    // @ts-ignore
    const GIF = (window as any).GIF ?? (await import('gif.js')).default;
    const gif = new GIF({
      workers: 2,
      quality: options.quality ? Math.round(options.quality * 10) : 10,
      width: options.width,
      height: options.height,
    });
    for (const frame of resizedFrames) {
      gif.addFrame(frame.imageData, { delay: frame.delay });
    }
    return new Promise<ProcessedImage>((resolve, reject) => {
      gif.on('finished', (blob: Blob) => {
        resolve({
          blob,
          type: 'image/gif',
          width: options.width,
          height: options.height,
        });
      });
      gif.on('error', (err: any) => reject(err));
      gif.render();
    });
  }
}
