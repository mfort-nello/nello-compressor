import type { FileKind } from "./types";

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

export function percentSavings(original: number, compressed: number): number {
  if (!original) return 0;
  return Math.max(0, Math.round(((original - compressed) / original) * 100));
}

export function classifyFile(file: File): FileKind | null {
  const type = file.type.toLowerCase();
  if (type === "image/gif") return "gif";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  // fall back to extension sniff for browsers that don't populate type
  const name = file.name.toLowerCase();
  if (name.endsWith(".gif")) return "gif";
  if (/\.(jpe?g|png|webp|heic|heif|avif|bmp|tiff?)$/.test(name)) return "image";
  if (/\.(mp4|mov|webm|mkv|m4v|avi)$/.test(name)) return "video";
  return null;
}

export function outputName(
  original: string,
  suffix: string,
  ext?: string,
): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  const origExt = dot > 0 ? original.slice(dot + 1) : "";
  return `${base}-${suffix}.${ext ?? origExt}`;
}
