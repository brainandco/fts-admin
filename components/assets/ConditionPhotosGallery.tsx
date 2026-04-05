/** Read-only grid of image URLs (purchase or return evidence). */
export function ConditionPhotosGallery({
  title,
  urls,
}: {
  title: string;
  urls: string[] | null | undefined;
}) {
  const list = Array.isArray(urls) ? urls.filter((u) => typeof u === "string" && u.trim()) : [];
  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-4">
        <h3 className="text-sm font-medium text-zinc-800">{title}</h3>
        <p className="mt-1 text-xs text-zinc-500">No photos on file.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {list.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-28 w-28 overflow-hidden rounded border border-zinc-200 bg-zinc-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  );
}
