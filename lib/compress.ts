"use client";

import imageCompression from "browser-image-compression";
import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./ffmpeg";
import type { CompressionSettings } from "./types";
import { outputName } from "./format";

export interface CompressResult {
  blob: Blob;
  name: string;
}

// ---- images ----------------------------------------------------------------

export async function compressImage(
  file: File,
  settings: CompressionSettings,
): Promise<CompressResult> {
  const format = settings.imageFormat;
  const targetMime =
    format === "webp"
      ? "image/webp"
      : format === "jpeg"
        ? "image/jpeg"
        : // auto: keep PNG as PNG (to preserve transparency), otherwise webp
          file.type === "image/png"
          ? "image/png"
          : "image/webp";

  const compressed = await imageCompression(file, {
    maxSizeMB: 100, // effectively unlimited — we let quality/dim drive size
    maxWidthOrHeight: settings.imageMaxDim,
    useWebWorker: true,
    initialQuality: settings.imageQuality,
    fileType: targetMime,
    alwaysKeepResolution: false,
  });

  const ext =
    targetMime === "image/webp"
      ? "webp"
      : targetMime === "image/jpeg"
        ? "jpg"
        : targetMime === "image/png"
          ? "png"
          : undefined;

  return {
    blob: compressed,
    name: outputName(file.name, "min", ext),
  };
}

// ---- video -----------------------------------------------------------------

export async function compressVideo(
  file: File,
  settings: CompressionSettings,
  onProgress?: (ratio: number) => void,
): Promise<CompressResult> {
  const ffmpeg = await getFFmpeg();

  const inExt = (file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4").toLowerCase();
  const inputName = `input${inExt}`;
  const outputFile = "output.mp4";

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // scale so longest side <= videoMaxDim, keep even dimensions for h264
    const vf = `scale='if(gt(iw,ih),min(${settings.videoMaxDim},iw),-2)':'if(gt(iw,ih),-2,min(${settings.videoMaxDim},ih))'`;

    await ffmpeg.exec([
      "-i", inputName,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "faster",
      "-crf", String(settings.videoCrf),
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-threads", "0",
      "-y",
      outputFile,
    ]);

    const data = await ffmpeg.readFile(outputFile);
    const bytes = data as Uint8Array;
    // Blob constructor rejects Uint8Array<SharedArrayBuffer>; copy into a
    // plain ArrayBuffer to keep TS and the runtime happy.
    const buffer = new Uint8Array(bytes).buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });

    return {
      blob,
      name: outputName(file.name, "min", "mp4"),
    };
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputFile).catch(() => {});
  }
}

// ---- gif -------------------------------------------------------------------

export async function compressGif(
  file: File,
  settings: CompressionSettings,
  onProgress?: (ratio: number) => void,
): Promise<CompressResult> {
  const ffmpeg = await getFFmpeg();

  const inputName = "input.gif";
  const palette = "palette.png";
  const outputFile = "output.gif";

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const filters = `fps=${settings.gifFps},scale=${settings.gifMaxWidth}:-1:flags=lanczos`;

    // pass 1 — generate an optimized palette
    await ffmpeg.exec([
      "-i", inputName,
      "-vf", `${filters},palettegen=stats_mode=diff`,
      "-y",
      palette,
    ]);

    // pass 2 — encode using the palette with dithering for smooth gradients
    await ffmpeg.exec([
      "-i", inputName,
      "-i", palette,
      "-lavfi",
        `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      "-y",
      outputFile,
    ]);

    const data = await ffmpeg.readFile(outputFile);
    const bytes = data as Uint8Array;
    const buffer = new Uint8Array(bytes).buffer;
    const blob = new Blob([buffer], { type: "image/gif" });

    return {
      blob,
      name: outputName(file.name, "min", "gif"),
    };
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(palette).catch(() => {});
    await ffmpeg.deleteFile(outputFile).catch(() => {});
  }
}
