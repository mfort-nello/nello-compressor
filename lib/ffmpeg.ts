"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

// Single-threaded core — doesn't require SharedArrayBuffer, so it works
// without the COOP/COEP header combo. We accept slightly slower video
// encoding in exchange for letting the Google Picker iframe load (COEP
// blocks cross-origin iframes from docs.google.com).
const CORE_VERSION = "0.12.6";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

export async function getFFmpeg(
  onLog?: (msg: string) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) ffmpeg.on("log", ({ message }) => onLog(message));

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${BASE_URL}/ffmpeg-core.js`,
        "text/javascript",
      ),
      wasmURL: await toBlobURL(
        `${BASE_URL}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}
