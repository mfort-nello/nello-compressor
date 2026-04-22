export type FileKind = "image" | "video" | "gif";

export type ItemStatus = "queued" | "working" | "done" | "error";

export type DriveUploadStatus = "idle" | "uploading" | "uploaded" | "failed";

export interface CompressedItem {
  id: string;
  original: File;
  kind: FileKind;
  originalSize: number;
  outputBlob?: Blob;
  outputName?: string;
  outputSize?: number;
  status: ItemStatus;
  progress: number;
  error?: string;
  fromDrive?: boolean;
  driveUploadStatus?: DriveUploadStatus;
  driveFileId?: string;
}

export interface CompressionSettings {
  imageQuality: number;
  imageMaxDim: number;
  imageFormat: "auto" | "webp" | "jpeg";
  videoCrf: number;
  videoMaxDim: number;
  gifMaxWidth: number;
  gifFps: number;
}

export const defaultSettings: CompressionSettings = {
  imageQuality: 0.8,
  imageMaxDim: 2000,
  imageFormat: "auto",
  videoCrf: 28,
  videoMaxDim: 1280,
  gifMaxWidth: 480,
  gifFps: 12,
};
