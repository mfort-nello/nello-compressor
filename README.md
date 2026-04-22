# compress.

Client-side image, video, and GIF compressor. Everything runs in the browser — files never leave the tab.

![stack](https://img.shields.io/badge/next-15-black) ![stack](https://img.shields.io/badge/react-19-black) ![stack](https://img.shields.io/badge/tailwind-4-black) ![stack](https://img.shields.io/badge/ffmpeg.wasm-0.12-black)

## What it does

- **Images** → `browser-image-compression` (Canvas). Quality, max dimension, auto/WebP/JPEG output.
- **Video** → `ffmpeg.wasm` with libx264 + AAC, CRF-controlled quality, H.264 MP4 output with `+faststart` for fast seeking.
- **GIFs** → `ffmpeg.wasm` two-pass palette generation (`palettegen` → `paletteuse`) for sharper results at lower sizes.

Serial queue processing — one file at a time — keeps the ffmpeg virtual filesystem clean and memory use predictable.

## Local dev

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy to Vercel

From the project root:

```bash
npx vercel            # first time, link/create project
npx vercel --prod     # deploy to production
```

Or push to GitHub and import through the Vercel dashboard. No environment variables, no backend. The first video/GIF compression pulls ffmpeg-core from unpkg (~25MB) and is cached after that.

## Architecture notes

**Why single-threaded ffmpeg-core?** The multi-threaded build needs `SharedArrayBuffer`, which needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Those break anything loaded cross-origin that doesn't send `Cross-Origin-Resource-Policy`. For a drop-in Vercel deploy, the single-threaded core is the path of least resistance. To swap to multi-threaded:

1. Point `BASE_URL` in `lib/ffmpeg.ts` to `@ffmpeg/core-mt`.
2. Add a `workerURL` entry to `ffmpeg.load()`.
3. Add COOP/COEP headers in `next.config.mjs`.

**Why serial, not parallel?** A single `FFmpeg` instance owns one virtual filesystem — running two operations in parallel on the same instance would collide. Spinning up multiple instances works but multiplies the 25MB engine load and memory footprint. Most users compress small batches, so serial is the pragmatic default.

**Where to tune:**
- Default settings → `lib/types.ts` (`defaultSettings`)
- Compression logic → `lib/compress.ts`
- Quality ranges and dimension presets → `components/Controls.tsx`

## Project layout

```
app/
  layout.tsx         fonts + metadata
  page.tsx           state orchestration, queue runner
  globals.css        tailwind v4 theme tokens + base styles
components/
  Header.tsx
  Dropzone.tsx       drag + browse
  FileRow.tsx        per-file status + download
  Controls.tsx       settings sidebar
lib/
  types.ts           CompressedItem, CompressionSettings
  format.ts          bytes, percent, file-kind detection
  ffmpeg.ts          lazy singleton loader
  compress.ts        image / video / gif entrypoints
```

## License

MIT — do whatever you want with it.
