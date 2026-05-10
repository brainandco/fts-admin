import { S3Client } from "@aws-sdk/client-s3";

let cachedEmployeeFilesS3: S3Client | null = null;
let cachedPpReportsDedicatedS3: S3Client | null = null;

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

/**
 * Bucket for per-employee uploads only. Must be set; does not use WASABI_BUCKET.
 * Use the same name as the dedicated employee-files bucket in Wasabi (e.g. fts-employee-files-prod).
 */
export function getWasabiEmployeeFilesBucket(): string {
  const b = process.env.WASABI_EMPLOYEE_FILES_BUCKET?.trim();
  if (!b) {
    throw new Error("WASABI_EMPLOYEE_FILES_BUCKET is not set (employee file storage).");
  }
  return b;
}

/**
 * S3 client for the employee file bucket only — use the dedicated Wasabi/IAM user (separate from software library).
 * Set: WASABI_EMPLOYEE_FILES_ACCESS_KEY, WASABI_EMPLOYEE_FILES_SECRET_ACCESS_KEY,
 * WASABI_EMPLOYEE_FILES_REGION, WASABI_EMPLOYEE_FILES_ENDPOINT, and WASABI_EMPLOYEE_FILES_BUCKET.
 */
/** Reuses one client per Node/Vercel isolate — avoids TLS + credential churn on every browse/search request. */
export function getWasabiEmployeeFilesS3Client(): S3Client {
  if (cachedEmployeeFilesS3) return cachedEmployeeFilesS3;
  const accessKeyId = process.env.WASABI_EMPLOYEE_FILES_ACCESS_KEY;
  const secretAccessKey = process.env.WASABI_EMPLOYEE_FILES_SECRET_ACCESS_KEY;
  const region = process.env.WASABI_EMPLOYEE_FILES_REGION;
  const endpoint = process.env.WASABI_EMPLOYEE_FILES_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !region || !endpoint) {
    throw new Error(
      "Employee file storage: set WASABI_EMPLOYEE_FILES_ACCESS_KEY, WASABI_EMPLOYEE_FILES_SECRET_ACCESS_KEY, WASABI_EMPLOYEE_FILES_REGION, and WASABI_EMPLOYEE_FILES_ENDPOINT (dedicated user for fts-employee-files-prod)."
    );
  }
  cachedEmployeeFilesS3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return cachedEmployeeFilesS3;
}

/** S3 key prefix (no leading/trailing slash). Default: employee-files */
export function getWasabiEmployeeFilesKeyPrefix(): string {
  const p = process.env.WASABI_EMPLOYEE_FILES_PREFIX?.trim();
  if (p) return p.replace(/^\/+|\/+$/g, "");
  return "employee-files";
}

/**
 * Optional presign-time max size (bytes) for employee / PP Wasabi uploads.
 * Unset, empty, or `"0"` = no application cap (single PUT still ~5 GiB max on typical S3-compatible APIs).
 * Set a positive integer to enforce a maximum.
 */
export function getWasabiEmployeeFileMaxBytes(): number {
  const raw = process.env.WASABI_EMPLOYEE_FILE_MAX_BYTES?.trim();
  if (!raw || raw === "0") return 0;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return 0;
}

export function getWasabiPpReportsBucket(): string | null {
  const b = process.env.WASABI_PP_REPORTS_BUCKET?.trim();
  return b || null;
}

export function isPpReportsBucketConfigured(): boolean {
  return getWasabiPpReportsBucket() != null;
}

export function getWasabiPpReportsKeyPrefix(): string {
  const p = process.env.WASABI_PP_REPORTS_PREFIX?.trim();
  if (!p) return "";
  return p.replace(/^\/+|\/+$/g, "");
}

/**
 * Optional separate Wasabi sub-user for PP final reports only.
 * Set all four, or omit all four to reuse WASABI_EMPLOYEE_FILES_* credentials for the PP bucket.
 */
export function isPpReportsDedicatedCredentialsConfigured(): boolean {
  const accessKeyId = process.env.WASABI_PP_REPORTS_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.WASABI_PP_REPORTS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.WASABI_PP_REPORTS_REGION?.trim();
  const endpoint = process.env.WASABI_PP_REPORTS_ENDPOINT?.trim();
  return !!(accessKeyId && secretAccessKey && region && endpoint);
}

/**
 * S3 client for `WASABI_PP_REPORTS_BUCKET`. Uses dedicated PP credentials when all of
 * WASABI_PP_REPORTS_ACCESS_KEY, WASABI_PP_REPORTS_SECRET_ACCESS_KEY, WASABI_PP_REPORTS_REGION,
 * WASABI_PP_REPORTS_ENDPOINT are set; otherwise falls back to {@link getWasabiEmployeeFilesS3Client}.
 */
export function getWasabiPpReportsS3Client(): S3Client {
  const accessKeyId = process.env.WASABI_PP_REPORTS_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.WASABI_PP_REPORTS_SECRET_ACCESS_KEY?.trim();
  const region = process.env.WASABI_PP_REPORTS_REGION?.trim();
  const endpoint = process.env.WASABI_PP_REPORTS_ENDPOINT?.trim();
  const partial =
    !!(accessKeyId || secretAccessKey || region || endpoint) &&
    !(accessKeyId && secretAccessKey && region && endpoint);
  if (partial) {
    throw new Error(
      "PP reports Wasabi user: set all of WASABI_PP_REPORTS_ACCESS_KEY, WASABI_PP_REPORTS_SECRET_ACCESS_KEY, WASABI_PP_REPORTS_REGION, WASABI_PP_REPORTS_ENDPOINT, or remove those variables to use the employee-files credentials."
    );
  }
  if (accessKeyId && secretAccessKey && region && endpoint) {
    if (!cachedPpReportsDedicatedS3) {
      cachedPpReportsDedicatedS3 = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
    }
    return cachedPpReportsDedicatedS3;
  }
  return getWasabiEmployeeFilesS3Client();
}
