// src/index.ts
import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { randomUUID } from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function buildStoredFileReference(filesRoutePrefix, key) {
  return `${filesRoutePrefix}/view?key=${encodeURIComponent(key)}`;
}
function createS3BlobStorage(options) {
  const filesRoutePrefix = options.filesRoutePrefix ?? "/api/files";
  const expiresIn = options.presignExpiresInSeconds ?? 3600;
  const client = new S3Client({
    region: options.region,
    endpoint: options.endpoint,
    credentials: options.accessKeyId && options.secretAccessKey ? {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    } : void 0
  });
  return {
    getUploadTarget(input) {
      return runPromise(
        Effect.gen(function* () {
          const extension = input.fileName.includes(".") ? input.fileName.split(".").pop() : void 0;
          const key = `${input.location}/${randomUUID()}${extension ? `.${extension}` : ""}`;
          const uploadUrl = yield* fromResult(
            getSignedUrl(
              client,
              new PutObjectCommand({
                Bucket: options.bucket,
                Key: key
              }),
              { expiresIn }
            )
          );
          return {
            uploadUrl,
            storedFileReference: buildStoredFileReference(
              filesRoutePrefix,
              key
            )
          };
        })
      );
    },
    readObject(input) {
      return runPromise(
        Effect.gen(function* () {
          const response = yield* fromResult(
            client.send(
              new GetObjectCommand({
                Bucket: options.bucket,
                Key: input.key
              })
            )
          );
          if (!response.Body) return null;
          const bytes = yield* fromResult(
            response.Body.transformToByteArray()
          );
          return { body: bytes, contentType: response.ContentType };
        }).pipe(Effect.catchAllCause(() => Effect.succeed(null)))
      );
    },
    getPresignedViewUrl(key) {
      return runPromise(
        Effect.suspend(
          () => fromResult(
            getSignedUrl(
              client,
              new GetObjectCommand({
                Bucket: options.bucket,
                Key: key
              }),
              { expiresIn }
            )
          )
        )
      );
    }
  };
}
export {
  createS3BlobStorage
};
