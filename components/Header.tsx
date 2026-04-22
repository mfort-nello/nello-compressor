export default function Header() {
  return (
    <header className="flex items-end justify-between border-b border-line pb-6 rise rise-1 gap-6">
      <div>
        <div className="flex items-center gap-2 label mb-4">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
          Internal Tool · Nello
        </div>
        <h1 className="display text-[68px] md:text-[96px] lg:text-[120px]">
          <span className="text-ink">COMP</span>
          <span className="gradient-text">RESSOR</span>
        </h1>
        <p className="mt-3 text-sm text-muted max-w-md">
          Shrink images, videos, and GIFs without uploading to a server.
          Compression happens right in your browser.
        </p>
      </div>
      <div className="text-right text-xs text-muted leading-relaxed hidden lg:block pb-2">
        <div className="label !text-[10px] mb-1">Supports</div>
        <div>JPG · PNG · WEBP · HEIC</div>
        <div>MP4 · MOV · WEBM · GIF</div>
      </div>
    </header>
  );
}
