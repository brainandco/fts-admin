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

/** Employee personal files bucket (e.g. fts-employee-files-prod). Falls back to WASABI_BUCKET. */
export function getWasabiEmployeeFilesBucket(): string {
  const b = process.env.WASABI_EMPLOYEE_FILES_BUCKET?.trim();
  if (b) return b;
  return getWasabiBucket();
}

/** S3 key prefix (no leading/trailing slash). Default: employee-files */
export function getWasabiEmployeeFilesKeyPrefix(): string {
  const p = process.env.WASABI_EMPLOYEE_FILES_PREFIX?.trim();
  if (p) return p.replace(/^\/+|\/+$/g, "");
  return "employee-files";
}

/** Max size for a single employee personal file. Default 100 MiB. */
export function getWasabiEmployeeFileMaxBytes(): number {
  const raw = process.env.WASABI_EMPLOYEE_FILE_MAX_BYTES;
  if (raw && /^\d+$/.test(raw.trim())) return parseInt(raw.trim(), 10);
  return 100 * 1024 * 1024;
}
