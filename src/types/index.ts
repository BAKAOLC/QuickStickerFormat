export interface StickerImage {
  id: string;
  file: File;
  name: string;
  preview: string;
  order: number;
  frameCount?: number;
  selectedFrame?: number;
}

export interface CoverImage {
  file: File;
  preview: string;
  fromStickers?: boolean;
  sourceImageId?: string;
}

export interface NameValidationRule {
  maxLength?: number;
  allowedChars?: RegExp;
  customValidator?: (name: string) => boolean;
}

export interface OutputFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  format: 'gif' | 'png' | 'jpg' | 'webp';
  filename: string;
  zipFilename?: string; // 如果需要输出为ZIP文件，这里定义ZIP文件名
}

export interface ExportFormat {
  id: string;
  name: string;
  description: string;
  requirements: {
    count: number;
    minCount?: number;
    maxCount?: number;
    allowVariable?: boolean;
    coverRequired?: boolean;
  };
  outputs: OutputFormat[];
  cover: {
    width: number;
    height: number;
    format: 'png' | 'jpg' | 'webp';
    filename: string;
  };
  validation?: {
    nameValidation?: NameValidationRule;
  };
}

export interface AppSettings {
  selectedFormat: string;
}
