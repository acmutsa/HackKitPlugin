// src/index.ts
import { Effect } from "effect";
import { runPromise, fromResult, operation } from "@hackkit/core/effect";
import { mkdir, readFile } from "fs/promises";
import { dirname, join, normalize, relative, resolve } from "path";
import { randomUUID } from "crypto";
function sanitizeKey(key) {
  const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..")) {
    throw new Error("Invalid storage key.");
  }
  return normalized;
}
function buildStoredFileReference(filesRoutePrefix, key) {
  return `${filesRoutePrefix}/view?key=${encodeURIComponent(key)}`;
}
function createLocalBlobStorage(options) {
  const baseDir = resolve(options.baseDir);
  const filesRoutePrefix = options.filesRoutePrefix ?? "/api/files";
  const appBaseUrl = options.appBaseUrl ?? "";
  const storage = {
    getUploadTarget(input) {
      return runPromise(
        Effect.gen(function* () {
          const extension = input.fileName.includes(".") ? input.fileName.split(".").pop() : void 0;
          const key = sanitizeKey(
            `${input.location}/${randomUUID()}${extension ? `.${extension}` : ""}`
          );
          const storedFileReference = buildStoredFileReference(
            filesRoutePrefix,
            key
          );
          const uploadUrl = `${appBaseUrl}${filesRoutePrefix}/upload?key=${encodeURIComponent(key)}`;
          return {
            uploadUrl,
            storedFileReference
          };
        })
      );
    },
    readObject(input) {
      return runPromise(
        Effect.gen(function* () {
          const key = sanitizeKey(input.key);
          const filePath = join(baseDir, key);
          if (relative(baseDir, filePath).startsWith(".."))
            return null;
          return yield* operation(() => readFile(filePath)).pipe(
            Effect.map((body) => ({ body })),
            Effect.orElseSucceed(() => null)
          );
        })
      );
    },
    resolveAbsolutePath(key) {
      const sanitized = sanitizeKey(key);
      return join(baseDir, sanitized);
    },
    ensureDirectoryForKey(key) {
      return runPromise(
        Effect.gen(function* () {
          const filePath = storage.resolveAbsolutePath(key);
          yield* fromResult(
            mkdir(dirname(filePath), { recursive: true })
          );
          return filePath;
        })
      );
    }
  };
  return storage;
}
export {
  createLocalBlobStorage
};
