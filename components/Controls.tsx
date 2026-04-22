"use client";

import type { CompressionSettings } from "@/lib/types";

export default function Controls({
  settings,
  onChange,
  disabled,
}: {
  settings: CompressionSettings;
  onChange: (s: CompressionSettings) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof CompressionSettings>(
    k: K,
    v: CompressionSettings[K],
  ) => onChange({ ...settings, [k]: v });

  return (
    <aside
      className={[
        "space-y-6 lg:sticky lg:top-8 self-start",
        "border border-line bg-surface rounded-2xl p-6",
        disabled ? "opacity-60 pointer-events-none" : "",
      ].join(" ")}
    >
      <div>
        <div className="label !text-[10px] mb-1">Settings</div>
        <div className="display text-2xl">FINE-TUNE</div>
      </div>

      <Section title="Image">
        <Slider
          label="Quality"
          value={Math.round(settings.imageQuality * 100)}
          min={10}
          max={100}
          step={5}
          display={(v) => `${v}%`}
          onChange={(v) => set("imageQuality", v / 100)}
        />
        <Picker
          label="Max dimension"
          value={settings.imageMaxDim}
          options={[720, 1080, 1600, 2000, 2560, 4096]}
          suffix="px"
          onChange={(v) => set("imageMaxDim", v)}
        />
        <PickerText
          label="Format"
          value={settings.imageFormat}
          options={[
            { v: "auto", label: "auto" },
            { v: "webp", label: "webp" },
            { v: "jpeg", label: "jpeg" },
          ]}
          onChange={(v) =>
            set("imageFormat", v as CompressionSettings["imageFormat"])
          }
        />
      </Section>

      <Divider />

      <Section title="Video">
        <Slider
          label="Quality"
          value={40 - settings.videoCrf}
          min={8}
          max={22}
          step={1}
          display={(v) => `${Math.round((v / 22) * 100)}%`}
          onChange={(v) => set("videoCrf", 40 - v)}
        />
        <Picker
          label="Max dimension"
          value={settings.videoMaxDim}
          options={[640, 854, 1280, 1920, 2560]}
          suffix="px"
          onChange={(v) => set("videoMaxDim", v)}
        />
      </Section>

      <Divider />

      <Section title="GIF">
        <Picker
          label="Max width"
          value={settings.gifMaxWidth}
          options={[240, 320, 480, 640, 800]}
          suffix="px"
          onChange={(v) => set("gifMaxWidth", v)}
        />
        <Picker
          label="Frame rate"
          value={settings.gifFps}
          options={[8, 10, 12, 15, 20, 24]}
          suffix="fps"
          onChange={(v) => set("gifFps", v)}
        />
      </Section>

      <p className="text-[11px] text-muted leading-relaxed pt-4 border-t border-line">
        First video or GIF triggers a one-time ~30MB FFmpeg engine download,
        then it&apos;s cached locally.
      </p>
    </aside>
  );
}

function Divider() {
  return <div className="h-px bg-line" />;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 label">{title}</div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-ink">{label}</span>
        <span className="num text-accent font-semibold">{display(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Picker({
  label,
  value,
  options,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-ink">{label}</span>
        <span className="num text-accent font-semibold">
          {value}
          {suffix}
        </span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`chip ${opt === value ? "chip-active" : ""}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerText({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-ink">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.v}
            onClick={() => onChange(opt.v)}
            className={`chip flex-1 ${opt.v === value ? "chip-active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
