"use client";

import { useCallback, useRef, useState } from "react";

export default function Dropzone({
  onFiles,
  onDriveImport,
  disabled,
  driveEnabled,
}: {
  onFiles: (files: File[]) => void;
  onDriveImport?: () => void;
  disabled?: boolean;
  driveEnabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles, disabled],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={[
        "relative select-none overflow-hidden",
        "rounded-3xl border-2 border-dashed py-20 px-6",
        "transition-all duration-300",
        dragging
          ? "border-accent bg-[rgba(0,174,249,0.06)] scale-[1.005]"
          : "border-line hover:border-muted bg-surface",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {dragging && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(400px 300px at 50% 50%, rgba(0,174,249,0.12), transparent 70%)",
          }}
        />
      )}

      <div className="text-center space-y-5 relative">
        <UploadIcon />
        <div className="display text-4xl md:text-5xl">
          <span className="text-ink">DROP FILES </span>
          <span className="text-muted">TO GET STARTED</span>
        </div>
        <div className="text-sm text-muted max-w-sm mx-auto">
          Drag and drop, browse your computer, or pull directly from Google
          Drive.
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
          <button
            onClick={() => !disabled && inputRef.current?.click()}
            disabled={disabled}
            className="btn-ghost"
          >
            <FolderIcon /> Browse files
          </button>
          {driveEnabled && onDriveImport && (
            <button
              onClick={onDriveImport}
              disabled={disabled}
              className="btn-drive"
            >
              <DriveIcon /> Import from Drive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <div className="flex justify-center">
      <div
        className="w-16 h-16 rounded-2xl grid place-items-center"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,174,249,0.18), rgba(0,101,198,0.08))",
          border: "1px solid rgba(0,101,198,0.2)",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DriveIcon() {
  // Google Drive's triangle mark, simplified
  return (
    <svg width="14" height="14" viewBox="0 0 87.3 78" aria-hidden>
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
