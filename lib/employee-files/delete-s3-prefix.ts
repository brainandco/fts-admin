import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";

/**
 * Remove every object under a prefix in the employee-files bucket (including nested "folders").
 * Prefix should be like "employee-files/east-est" (trailing slash added internally).
 */
export async function deleteAllS3WithPrefix(s3: S3Client, bucket: string, prefix: string): Promise<void> {
  const p = prefix.replace(/\/+$/, "") + "/";
  let continuationToken: string | undefined;
  for (;;) {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: p,
        ContinuationToken: continuationToken,
      })
    );
    const keys = (list.Contents ?? []).map((c) => c.Key).filter((k): k is string => !!k);
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch, Quiet: true },
        })
      );
    }
    if (list.IsTruncated && list.NextContinuationToken) {
      continuationToken = list.NextContinuationToken;
    } else {
      break;
    }
  }
}
