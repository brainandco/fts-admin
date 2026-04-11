import { S3Client } from "@aws-sdk/client-s3";

/** S3-compatible client for Wasabi (credentials and endpoint from env). */
export function getWasabiS3Client(): S3Client {
  const accessKeyId = process.env.WASABI_ACCESS_KEY;
  const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY;
  const region = process.env.WASABI_REGION;
  const endpoint = process.env.WASABI_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !region || !endpoint) {
    throw new Error("Wasabi is not configured. Set WASABI_ACCESS_KEY, WASABI_SECRET_ACCESS_KEY, WASABI_REGION, and WASABI_ENDPOINT.");
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export function getWasabiBucket(): string {
  const b = process.env.WASABI_BUCKET;
  if (!b?.trim()) {
    throw new Error("WASABI_BUCKET is not set.");
  }
  return b.trim();
}

/** Optional cap for presigned uploads (bytes). Default 15 GiB. */
export function getWasabiMaxUploadBytes(): number {
  const raw = process.env.WASABI_MAX_UPLOAD_BYTES;
  if (raw && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return 15 * 1024 * 1024 * 1024;
}
