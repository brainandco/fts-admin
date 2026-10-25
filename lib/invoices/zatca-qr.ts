/** Decode a ZATCA e-invoice QR payload (base64 TLV). Tags 1–5 are text. */

export type ZatcaQrFields = {
  sellerName: string | null;
  vatNumber: string | null;
  timestamp: string | null;
  totalWithVat: number | null;
  vatAmount: number | null;
};

function money(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function decodeZatcaQr(payload: string): ZatcaQrFields | null {
  const compact = payload.replace(/\s+/g, "");
  if (compact.length < 8) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(compact, "base64");
  } catch {
    return null;
  }
  if (buf.length < 5) return null;

  const tags = new Map<number, string>();
  let i = 0;
  while (i + 2 <= buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    i += 2;
    if (i + len > buf.length) break;
    const slice = buf.subarray(i, i + len);
    i += len;
    if (tag >= 1 && tag <= 5) tags.set(tag, slice.toString("utf8"));
  }
  if (!tags.has(4) && !tags.has(2)) return null;

  return {
    sellerName: tags.get(1)?.trim() || null,
    vatNumber: tags.get(2)?.trim() || null,
    timestamp: tags.get(3)?.trim() || null,
    totalWithVat: tags.get(4) ? money(tags.get(4)!) : null,
    vatAmount: tags.get(5) ? money(tags.get(5)!) : null,
  };
}
