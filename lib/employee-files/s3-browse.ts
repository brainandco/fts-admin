import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";

export type BrowseEntry =
  | { type: "folder"; name: string; prefix: string }
  | { type: "file"; name: string; key: string; size: number | null; lastModified: string | null };

const LIST_PAGE_MAX_KEYS = 1000;

/** Flat list of object keys under prefix (no delimiter), paginated. Stops at maxKeys. */
export async function listAllObjectKeysUnderPrefix(
  s3: S3Client,
  bucket: string,
  prefix: string,
  maxKeys: number
): Promise<{ keys: string[]; truncated: boolean }> {
  const p = prefix.replace(/\/*$/, "/");
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: p,
        MaxKeys: LIST_PAGE_MAX_KEYS,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of list.Contents ?? []) {
      const key = obj.Key;
      if (!key || key.endsWith("/.keep")) continue;
      keys.push(key);
      if (keys.length >= maxKeys) {
        return { keys, truncated: true };
      }
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
  return { keys, truncated: false };
}

export async function browsePrefix(s3: S3Client, bucket: string, prefix: string): Promise<BrowseEntry[]> {
  const p = prefix.replace(/\/*$/, "/");
  const out: BrowseEntry[] = [];
  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: p,
      Delimiter: "/",
      MaxKeys: LIST_PAGE_MAX_KEYS,
    })
  );
  for (const cp of list.CommonPrefixes ?? []) {
    const full = cp.Prefix ?? "";
    const name = full.slice(p.length).replace(/\/$/, "");
    if (name) out.push({ type: "folder", name, prefix: full });
  }
  for (const obj of list.Contents ?? []) {
    const key = obj.Key;
    if (!key || key.endsWith("/") || key.endsWith("/.keep")) continue;
    const name = key.slice(p.length);
    if (!name || name.includes("/")) continue;
    out.push({
      type: "file",
      name,
      key,
      size: obj.Size ?? null,
      lastModified: obj.LastModified?.toISOString() ?? null,
    });
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}
