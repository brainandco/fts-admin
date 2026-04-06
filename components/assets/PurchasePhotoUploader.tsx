"use client";

import { useState } from "react";
import {
  MAX_RESOURCE_PHOTOS,
  MIN_RESOURCE_PHOTOS,
} from "@/lib/assets/resource-photos";

type Purpose = "asset-purchase" | "vehicle-purchase";

export function PurchasePhotoUploader({
  purpose,
  urls,
  onUrlsChange,
  disabled,
}: {
  purpose: Purpose;
  urls: string[];
  onUrlsChange: (urls: string[]) => void;
  disabled?: boolean;
}) {
  const assetPhotosOptional = purpose === "asset-purchase";
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file || disabled) return;
    if (urls.length >= MAX_RESOURCE_PHOTOS) {
      setError(`You can add at most ${MAX_RESOURCE_PHOTOS} photos.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("purpose", purpose);
      const res = await fetch("/api/uploads/resource-photo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "Upload failed");
        return;
      }
      if (typeof data.url === "string") {
        onUrlsChange([...urls, data.url]);
      }
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    onUrlsChange(urls.filter((_, j) => j !== i));
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
      <label className="mb-2 block text-sm font-medium text-zinc-800">
        Condition photos (purchase / intake)
        {assetPhotosOptional ? (
          <span className="font-normal text-zinc-500"> (optional)</span>
        ) : (
          <span className="text-red-600"> *</span>
        )}
      </label>
      <p className="mb-3 text-xs text-zinc-600">
        {assetPhotosOptional ? (
          <>
            Clear photos as received help with returns and dispute review. You can add them when registering new stock
            or later from the asset record.
          </>
        ) : (
          <>
            Add at least {MIN_RESOURCE_PHOTOS} clear photos of the item as received. These support return and dispute
            review later.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div key={url + i} className="relative h-20 w-20 overflow-hidden rounded border border-zinc-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-0 top-0 rounded-bl bg-black/60 px-1.5 py-0.5 text-xs text-white hover:bg-black/80"
                aria-label="Remove photo"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {!disabled && urls.length < MAX_RESOURCE_PHOTOS ? (
        <div className="mt-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            className="text-sm file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void handleFile(f);
            }}
          />
          {uploading ? <span className="ml-2 text-xs text-zinc-500">Uploading…</span> : null}
        </div>
      ) : null}
      <p
        className={`mt-2 text-xs ${
          assetPhotosOptional
            ? "text-zinc-600"
            : urls.length >= MIN_RESOURCE_PHOTOS
              ? "text-emerald-700"
              : "text-amber-800"
        }`}
      >
        {assetPhotosOptional ? (
          <>
            {urls.length} photo{urls.length === 1 ? "" : "s"} — optional for now; recommended when you can.
          </>
        ) : (
          <>
            {urls.length} / {MIN_RESOURCE_PHOTOS} minimum
            {urls.length < MIN_RESOURCE_PHOTOS ? " — add more photos to save." : " — OK."}
          </>
        )}
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
