"use client";

import type { CompressedItem } from "@/lib/types";
import { formatBytes, percentSavings } from "@/lib/format";

export default function FileRow({
  item,
  onRemove,
  onRetry,
}: {
  item: CompressedItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const savings =
    item.outputSize != null
      ? percentSavings(item.originalSize, item.outputSize)
      : null;

  const grewBy =
    item.outputSize != null && item.outputSize > item.originalSize
      ? Math.round(
          ((item.outputSize - item.originalSize) / item.originalSize) * 100,
        )
      : null;

  const download = () => {
    if (!item.outputBlob || !item.outputName) return;
    const url = URL.createObjectURL(item.outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.outputName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="group border border-line bg-surface rounded-2xl p-4 transition-colors hover:border-muted/60 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
      <KindBadge kind={item.kind} status={item.status} />

      <div className="min-w-0">
        <div className="truncate text-ink font-medium flex items-center gap-2">
          {item.fromDrive && <DriveMark />}
          {item.original.name}
        </div>
        <div className="text-xs text-muted num mt-1 flex items-center gap-2 flex-wrap">
          <span>{formatBytes(item.originalSize)}</span>
          {item.outputSize != null && (
            <>
              <Arrow />
              <span className="text-ink font-semibold">
                {formatBytes(item.outputSize)}
              </span>
              {savings != null && savings > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: "rgba(0,101,198,0.1)",
                    color: "var(--color-accent)",
                  }}
                >
                  −{savings}%
                </span>
              )}
              {grewBy != null && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: "rgba(217,119,6,0.12)",
                    color: "var(--color-warn)",
                  }}
                >
                  +{grewBy}%
                </span>
              )}
            </>
          )}
          {item.status === "error" && item.error && (
            <span className="text-danger">· {truncateError(item.error)}</span>
          )}
          {item.driveUploadStatus === "uploading" && (
            <span className="text-accent">· uploading to Drive…</span>
          )}
          {item.driveUploadStatus === "uploaded" && (
            <span className="text-accent">· saved to Drive</span>
          )}
        </div>
        {item.status === "working" && (
          <div className="mt-2.5 h-1 w-full bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full transition-[width] duration-200 ease-linear rounded-full"
              style={{
                width: `${Math.round(item.progress * 100)}%`,
                background:
                  "linear-gradient(90deg, var(--color-accent), var(--color-accent-bright))",
              }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {item.status === "working" && (
          <span className="text-xs text-accent num font-semibold">
            {Math.round(item.progress * 100)}%
          </span>
        )}
        {item.status === "done" && (
          <button
            onClick={download}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:brightness-110"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent-bright), var(--color-accent))",
            }}
          >
            Download
          </button>
        )}
        {item.status === "error" && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-danger text-danger hover:bg-danger/10 transition"
          >
            Retry
          </button>
        )}
        {item.status !== "working" && (
          <button
            onClick={onRemove}
            aria-label="Remove"
            className="w-8 h-8 rounded-full grid place-items-center text-muted hover:text-ink hover:bg-subtle transition"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-muted">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DriveMark() {
  return (
    <span
      title="Imported from Google Drive"
      className="inline-flex items-center justify-center w-4 h-4 flex-shrink-0"
    >
      <svg width="12" height="12" viewBox="0 0 87.3 78" aria-hidden>
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
      </svg>
    </span>
  );
}

function KindBadge({
  kind,
  status,
}: {
  kind: CompressedItem["kind"];
  status: CompressedItem["status"];
}) {
  const bg =
    status === "done"
      ? "rgba(0,101,198,0.1)"
      : status === "error"
        ? "rgba(220,38,38,0.1)"
        : status === "working"
          ? "rgba(217,119,6,0.12)"
          : "rgba(107,109,114,0.08)";
  const fg =
    status === "done"
      ? "var(--color-accent)"
      : status === "error"
        ? "var(--color-danger)"
        : status === "working"
          ? "var(--color-warn)"
          : "var(--color-muted)";
  const pulse = status === "working" ? "pulse-dot" : "";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${pulse}`}
      style={{ background: bg, color: fg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: fg }}
      />
      {kind}
    </div>
  );
}

function truncateError(msg: string): string {
  const first = msg.split("\n")[0];
  return first.length > 80 ? first.slice(0, 77) + "…" : first;
}
