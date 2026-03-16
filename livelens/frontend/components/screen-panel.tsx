"use client";

import { DragEvent, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

interface ScreenPanelProps {
  previewImageUrl?: string | null;
  summary?: string | null;
  loading?: boolean;
  onUpload: (file: File) => Promise<void>;
  compact?: boolean;
}

export function ScreenPanel({
  previewImageUrl,
  summary,
  loading = false,
  onUpload,
  compact = false,
}: ScreenPanelProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      await onUpload(file);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await onUpload(file);
  }

  if (previewImageUrl && !loading) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Uploaded screenshot" className="w-full object-cover" src={previewImageUrl} />
        </div>
        {summary && (
          <div className="rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3 text-xs leading-5 text-mist">
            {summary}
          </div>
        )}
        <button
          className="text-xs text-mist/60 underline underline-offset-2 hover:text-mist transition"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Upload a different screenshot
        </button>
        <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition cursor-pointer
        ${dragging ? "border-glow bg-glow/10" : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"}
        ${compact ? "py-8 px-6" : "py-16 px-8"}
      `}
      onClick={() => inputRef.current?.click()}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
      {loading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-glow mb-3" />
          <p className="text-sm text-mist">Analyzing screenshot…</p>
        </>
      ) : (
        <>
          <ImagePlus className={`text-glow/60 mb-3 ${compact ? "h-7 w-7" : "h-10 w-10"}`} />
          <p className={`font-medium text-white text-center ${compact ? "text-sm" : "text-base"}`}>
            Drop a screenshot here
          </p>
          <p className="mt-1 text-xs text-mist text-center">or click to browse</p>
        </>
      )}
    </div>
  );
}
