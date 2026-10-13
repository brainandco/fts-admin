/** Escape `%` / `_` for Postgres ILIKE patterns. */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Split a full storage key into employee folder slug + path under that employee,
 * given the region prefix (`…/regionSeg/`).
 */
export function splitKeyUnderRegionPrefix(
  storageKey: string,
  regionFilesPrefix: string
): { employeeFolderSlug: string; relativePath: string } | null {
  const root = regionFilesPrefix.replace(/\/*$/, "/");
  if (!storageKey.startsWith(root)) return null;
  const rest = storageKey.slice(root.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const employeeFolderSlug = rest.slice(0, slash);
  const relativePath = rest.slice(slash + 1);
  if (!employeeFolderSlug || !relativePath) return null;
  return { employeeFolderSlug, relativePath };
}

/**
 * Find relative paths (under employee root) where a path segment matches a site / folder query.
 * Prefers exact case-insensitive segment match; for queries of length ≥ 3, also matches folder segments
 * (no dot) that contain the query as substring, and file names that contain the query.
 */
export function matchSiteFolderPaths(
  relativeObjectKeys: string[],
  queryRaw: string
): Map<string, { siteSegment: string; folderPath: string }> {
  const query = queryRaw.trim();
  if (!query) return new Map();
  const qLower = query.toLowerCase();
  const out = new Map<string, { siteSegment: string; folderPath: string }>();

  for (const rel of relativeObjectKeys) {
    const parts = rel.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let matchIdx = -1;
    let matchedSeg = "";

    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]!;
      const noExt = seg.includes(".") ? seg.slice(0, seg.lastIndexOf(".")) : seg;
      if (seg.toLowerCase() === qLower || noExt.toLowerCase() === qLower) {
        matchIdx = i;
        matchedSeg = seg.includes(".") ? noExt : seg;
        break;
      }
    }

    if (matchIdx < 0 && query.length >= 3) {
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]!;
        if (seg.includes(".")) continue;
        if (seg.toLowerCase().includes(qLower)) {
          matchIdx = i;
          matchedSeg = seg;
          break;
        }
      }
    }

    // Codes often appear only in the file name (e.g. "ZSK938 N77.rar") — open parent folder.
    if (matchIdx < 0 && query.length >= 3) {
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]!;
        if (!seg.includes(".")) continue;
        const noExt = seg.slice(0, seg.lastIndexOf("."));
        if (noExt.toLowerCase().includes(qLower) || seg.toLowerCase().includes(qLower)) {
          if (i > 0) {
            matchIdx = i - 1;
            matchedSeg = parts[i - 1]!;
          } else {
            // File at employee root — use empty path (open employee root).
            if (!out.has("")) {
              out.set("", { siteSegment: noExt || seg, folderPath: "" });
            }
            matchIdx = -2; // handled
          }
          break;
        }
      }
    }

    if (matchIdx === -2) continue;
    if (matchIdx < 0) continue;

    // If exact match landed on a file segment, open its parent folder.
    if (parts[matchIdx]?.includes(".")) {
      if (matchIdx === 0) {
        if (!out.has("")) {
          out.set("", { siteSegment: matchedSeg, folderPath: "" });
        }
        continue;
      }
      matchIdx = matchIdx - 1;
      matchedSeg = parts[matchIdx]!;
    }

    const folderPath = parts.slice(0, matchIdx + 1).join("/");
    if (!out.has(folderPath)) {
      out.set(folderPath, { siteSegment: matchedSeg, folderPath });
    }
  }

  return out;
}

/** True when query looks like an employee folder slug / id fragment / name. */
export function employeeIdentityMatchesQuery(
  emp: { id: string; full_name: string | null; email?: string | null },
  employeeFolderSlug: string | null | undefined,
  queryRaw: string
): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (q.length < 2) return false;
  const idCompact = emp.id.replace(/-/g, "").toLowerCase();
  if (idCompact.includes(q)) return true;
  if ((emp.full_name ?? "").toLowerCase().includes(q)) return true;
  if ((emp.email ?? "").toLowerCase().includes(q)) return true;
  if ((employeeFolderSlug ?? "").toLowerCase().includes(q)) return true;
  return false;
}

export function stripEmployeeRootFromKey(fullKey: string, employeeRootPrefix: string): string | null {
  const r = employeeRootPrefix.replace(/\/*$/, "/");
  if (!fullKey.startsWith(r)) return null;
  return fullKey.slice(r.length);
}
