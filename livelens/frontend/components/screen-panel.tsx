"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";

interface ScreenPanelProps {
  previewImageUrl?: string | null;
  summary?: string;
  loading?: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function ScreenPanel({ previewImageUrl, summary, loading = false, onUpload }: ScreenPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Screen Context</h3>
          <p className="text-sm text-mist">Screenshot-first for reliable visual grounding. Live streaming can slot in later.</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-glow hover:text-glow disabled:opacity-60"
          disabled={loading || uploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          {uploading ? "Uploading..." : "Upload screenshot"}
        </button>
      </div>
      <input
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleChange}
        ref={fileInputRef}
        type="file"
      />
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
        {loading ? (
          <div className="flex aspect-[16/10] items-center justify-center p-8 text-center text-sm text-mist">
            Analyzing visual context...
          </div>
        ) : previewImageUrl ? (
          <div className="relative aspect-[16/10] w-full">
            <Image
              alt="Uploaded screen preview"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              src={previewImageUrl}
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center p-8 text-center text-sm text-mist">
            Upload a screenshot of the current workflow. LiveLens will describe only visible evidence and turn it into the next best step.
          </div>
        )}
      </div>
      <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4 text-sm text-mist">
        {loading ? "Reading visible UI, required fields, and blockers..." : summary ?? "No screen analysis yet."}
      </div>
    </section>
  );
}
