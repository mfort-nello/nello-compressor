"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import FileRow from "@/components/FileRow";
import Controls from "@/components/Controls";
import {
  compressGif,
  compressImage,
  compressVideo,
} from "@/lib/compress";
import {
  createDriveFolder,
  downloadDriveFile,
  isDriveConfigured,
  pickFromDrive,
  uploadBlobToDrive,
  type DrivePickedFile,
} from "@/lib/drive";
import { classifyFile, formatBytes, percentSavings } from "@/lib/format";
import type { CompressedItem, CompressionSettings } from "@/lib/types";
import { defaultSettings } from "@/lib/types";

export default function Page() {
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [settings, setSettings] =
    useState<CompressionSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [driveImporting, setDriveImporting] = useState(false);
  const [driveExporting, setDriveExporting] = useState(false);
  const [toast, setToast] = useState<{
    kind: "info" | "error" | "success";
    text: string;
  } | null>(null);
  const [driveEnabled, setDriveEnabled] = useState(false);
  const idRef = useRef(0);

  // Drive config is read on client-side only — avoid SSR/hydration mismatch
  useEffect(() => {
    setDriveEnabled(isDriveConfigured());
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const addFiles = useCallback(
    (files: File[], meta?: { fromDrive?: boolean }) => {
      const next: CompressedItem[] = [];
      const skipped: string[] = [];
      for (const file of files) {
        const kind = classifyFile(file);
        if (!kind) {
          skipped.push(file.name);
          continue;
        }
        next.push({
          id: String(++idRef.current),
          original: file,
          kind,
          originalSize: file.size,
          status: "queued",
          progress: 0,
          fromDrive: meta?.fromDrive,
        });
      }
      if (next.length) setItems((prev) => [...prev, ...next]);
      if (skipped.length) {
        setToast({
          kind: "error",
          text: `Skipped ${skipped.length} unsupported ${skipped.length === 1 ? "file" : "files"}`,
        });
      }
    },
    [],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<CompressedItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const processOne = useCallback(
    async (item: CompressedItem) => {
      updateItem(item.id, {
        status: "working",
        progress: 0,
        error: undefined,
      });
      const needsEngine = item.kind !== "image";
      if (needsEngine) setEngineLoading(true);

      try {
        const onProgress = (r: number) =>
          updateItem(item.id, { progress: r });

        const result =
          item.kind === "image"
            ? await compressImage(item.original, settings)
            : item.kind === "video"
              ? await compressVideo(item.original, settings, onProgress)
              : await compressGif(item.original, settings, onProgress);

        updateItem(item.id, {
          status: "done",
          progress: 1,
          outputBlob: result.blob,
          outputName: result.name,
          outputSize: result.blob.size,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        updateItem(item.id, { status: "error", error: message });
      } finally {
        if (needsEngine) setEngineLoading(false);
      }
    },
    [settings, updateItem],
  );

  const processAll = useCallback(async () => {
    const snapshot = items.filter(
      (it) => it.status === "queued" || it.status === "error",
    );
    if (!snapshot.length) return;

    setBusy(true);
    const images = snapshot.filter((it) => it.kind === "image");
    const media = snapshot.filter((it) => it.kind !== "image");

    await Promise.all([
      Promise.all(images.map(processOne)),
      (async () => {
        for (const it of media) await processOne(it);
      })(),
    ]);
    setBusy(false);
  }, [items, processOne]);

  const downloadAll = useCallback(() => {
    const done = items.filter((it) => it.status === "done" && it.outputBlob);
    for (const it of done) {
      if (!it.outputBlob || !it.outputName) continue;
      const url = URL.createObjectURL(it.outputBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = it.outputName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, [items]);

  // ---- Drive import -------------------------------------------------------

  const handleDriveImport = useCallback(async () => {
    if (driveImporting) return;
    setDriveImporting(true);
    try {
      const picked = await pickFromDrive();
      if (!picked.length) return;

      // Add placeholder rows immediately so user sees progress
      const placeholders: CompressedItem[] = picked.map((p: DrivePickedFile) => ({
        id: String(++idRef.current),
        original: new File([], p.name, { type: p.mimeType }),
        kind: (classifyFile(
          new File([], p.name, { type: p.mimeType }),
        ) ?? "image") as CompressedItem["kind"],
        originalSize: p.size,
        status: "working" as const,
        progress: 0,
        fromDrive: true,
      }));
      setItems((prev) => [...prev, ...placeholders]);

      // Download each serially to avoid hammering Drive with parallel reqs
      for (let i = 0; i < picked.length; i++) {
        const p = picked[i];
        const placeholder = placeholders[i];
        try {
          const file = await downloadDriveFile(p, (r) =>
            updateItem(placeholder.id, { progress: r }),
          );
          const kind = classifyFile(file);
          if (!kind) {
            updateItem(placeholder.id, {
              status: "error",
              error: "Unsupported file type",
            });
            continue;
          }
          updateItem(placeholder.id, {
            original: file,
            kind,
            originalSize: file.size,
            status: "queued",
            progress: 0,
          });
        } catch (err) {
          updateItem(placeholder.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Download failed",
          });
        }
      }

      setToast({
        kind: "success",
        text: `Imported ${picked.length} ${picked.length === 1 ? "file" : "files"} from Drive`,
      });
    } catch (err) {
      setToast({
        kind: "error",
        text: err instanceof Error ? err.message : "Drive import failed",
      });
    } finally {
      setDriveImporting(false);
    }
  }, [driveImporting, updateItem]);

  // ---- Drive export -------------------------------------------------------

  const handleDriveExport = useCallback(async () => {
    if (driveExporting) return;
    const done = items.filter((it) => it.status === "done" && it.outputBlob);
    if (!done.length) return;

    setDriveExporting(true);
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const folderName = `Nello Compressor · ${ts}`;
      const folderId = await createDriveFolder(folderName);

      // Mark all as uploading
      setItems((prev) =>
        prev.map((it) =>
          done.find((d) => d.id === it.id)
            ? { ...it, driveUploadStatus: "uploading" as const }
            : it,
        ),
      );

      for (const it of done) {
        try {
          const uploaded = await uploadBlobToDrive(
            it.outputBlob!,
            it.outputName!,
            folderId,
          );
          updateItem(it.id, {
            driveUploadStatus: "uploaded",
            driveFileId: uploaded.id,
          });
        } catch (err) {
          updateItem(it.id, { driveUploadStatus: "failed" });
          // eslint-disable-next-line no-console
          console.error("Upload failed for", it.outputName, err);
        }
      }

      setToast({
        kind: "success",
        text: `Uploaded to Drive in folder "${folderName}"`,
      });
    } catch (err) {
      setToast({
        kind: "error",
        text: err instanceof Error ? err.message : "Drive export failed",
      });
    } finally {
      setDriveExporting(false);
    }
  }, [driveExporting, items, updateItem]);

  const totals = useMemo(() => {
    const processed = items.filter((it) => it.outputSize != null);
    const out = processed.reduce((s, it) => s + (it.outputSize ?? 0), 0);
    const origOfProcessed = processed.reduce(
      (s, it) => s + it.originalSize,
      0,
    );
    const saved = percentSavings(origOfProcessed, out);
    return {
      origOfProcessed,
      out,
      saved,
      processedCount: processed.length,
    };
  }, [items]);

  const anyDone = totals.processedCount > 0;
  const hasPending = items.some(
    (it) => it.status === "queued" || it.status === "error",
  );

  return (
    <main className="min-h-screen max-w-[1280px] mx-auto px-6 md:px-10 py-8 md:py-12 relative z-10">
      <Header />

      <div className="mt-10 md:mt-14 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 lg:gap-12">
        <div className="space-y-6 min-w-0 rise rise-2">
          <Dropzone
            onFiles={addFiles}
            onDriveImport={handleDriveImport}
            driveEnabled={driveEnabled}
            disabled={busy || driveImporting}
          />

          {driveImporting && (
            <div className="text-xs text-accent flex items-center gap-2 px-3 py-2 rounded-full bg-accent/10 border border-accent/20 w-fit">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
              Importing from Drive…
            </div>
          )}

          {items.length > 0 && (
            <>
              {totals.processedCount > 0 && (
                <div className="rounded-2xl border border-line bg-surface px-5 py-4 flex items-center gap-6 flex-wrap">
                  <Stat
                    label="Files processed"
                    value={String(totals.processedCount)}
                  />
                  <Stat
                    label="Original"
                    value={formatBytes(totals.origOfProcessed)}
                  />
                  <Stat
                    label="Compressed"
                    value={formatBytes(totals.out)}
                    accent
                  />
                  {totals.saved > 0 && (
                    <Stat
                      label="Saved"
                      value={`${totals.saved}%`}
                      accent
                      big
                    />
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="label">
                  Queue · {items.length}{" "}
                  {items.length === 1 ? "file" : "files"}
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={clearAll}
                    disabled={busy || driveExporting}
                    className="btn-ghost"
                  >
                    Clear all
                  </button>
                  {anyDone && (
                    <button
                      onClick={downloadAll}
                      disabled={busy || driveExporting}
                      className="btn-ghost"
                    >
                      Download all
                    </button>
                  )}
                  {anyDone && driveEnabled && (
                    <button
                      onClick={handleDriveExport}
                      disabled={busy || driveExporting}
                      className="btn-drive"
                    >
                      {driveExporting
                        ? "Uploading…"
                        : "Save all to Drive"}
                    </button>
                  )}
                  <button
                    onClick={processAll}
                    disabled={busy || !hasPending || driveExporting}
                    className="btn-primary"
                  >
                    {busy ? "COMPRESSING…" : "COMPRESS"}
                  </button>
                </div>
              </div>

              {engineLoading && !isEngineReady(items) && (
                <div className="text-xs text-warn flex items-center gap-2 px-3 py-2 rounded-full bg-warn/10 border border-warn/20 w-fit">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-warn pulse-dot" />
                  Loading FFmpeg engine (one-time ~30MB download)…
                </div>
              )}

              <div className="space-y-3">
                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onRetry={() => processOne(item)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rise rise-3">
          <Controls
            settings={settings}
            onChange={setSettings}
            disabled={busy}
          />
        </div>
      </div>

      <footer className="mt-24 pt-6 border-t border-line text-xs text-muted flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="display text-base text-ink">NELLO</span>
          <span className="opacity-50">·</span>
          <span>Internal tooling</span>
        </div>
        <div>No uploads · No tracking · Drive integration optional</div>
      </footer>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={[
            "fixed bottom-6 right-6 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium toast-enter z-50 max-w-md",
            toast.kind === "error"
              ? "bg-surface border-danger/30 text-danger"
              : toast.kind === "success"
                ? "bg-surface border-accent/30 text-accent"
                : "bg-surface border-line text-ink",
          ].join(" ")}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: boolean;
  big?: boolean;
}) {
  return (
    <div>
      <div className="label !text-[9px] mb-0.5">{label}</div>
      <div
        className={[
          "num font-semibold",
          big ? "display text-3xl" : "text-base",
          accent ? "text-accent" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function isEngineReady(items: CompressedItem[]): boolean {
  return items.some((it) => it.kind !== "image" && it.status === "done");
}
