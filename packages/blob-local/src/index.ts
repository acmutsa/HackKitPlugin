import { Effect } from "effect";
import { runPromise, fromResult, operation } from "@hackkit/core/effect";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
	type BlobStorageAdapterWithView,
	type BlobUploadTarget,
	type BlobViewResult,
} from "@hackkit/core";
export type LocalBlobStorageOptions = {
	baseDir: string;
	filesRoutePrefix?: string;
	appBaseUrl?: string;
};
function sanitizeKey(key: string): string {
	const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
	if (normalized.startsWith("..")) {
		throw new Error("Invalid storage key.");
	}
	return normalized;
}
function buildStoredFileReference(
	filesRoutePrefix: string,
	key: string,
): string {
	return `${filesRoutePrefix}/view?key=${encodeURIComponent(key)}`;
}
export type LocalBlobStorage = BlobStorageAdapterWithView & {
	resolveAbsolutePath(key: string): string;
	ensureDirectoryForKey(key: string): Promise<string>;
};
export function createLocalBlobStorage(
	options: LocalBlobStorageOptions,
): LocalBlobStorage {
	const baseDir = resolve(options.baseDir);
	const filesRoutePrefix = options.filesRoutePrefix ?? "/api/files";
	const appBaseUrl = options.appBaseUrl ?? "";
	const storage: LocalBlobStorage = {
		getUploadTarget(input): Promise<BlobUploadTarget> {
			return runPromise(
				Effect.gen(function* () {
					const extension = input.fileName.includes(".")
						? input.fileName.split(".").pop()
						: undefined;
					const key = sanitizeKey(
						`${input.location}/${randomUUID()}${extension ? `.${extension}` : ""}`,
					);
					const storedFileReference = buildStoredFileReference(
						filesRoutePrefix,
						key,
					);
					const uploadUrl = `${appBaseUrl}${filesRoutePrefix}/upload?key=${encodeURIComponent(key)}`;
					return {
						uploadUrl,
						storedFileReference,
					};
				}),
			);
		},
		readObject(input): Promise<BlobViewResult | null> {
			return runPromise(
				Effect.gen(function* () {
					const key = sanitizeKey(input.key);
					const filePath = join(baseDir, key);
					if (relative(baseDir, filePath).startsWith(".."))
						return null;
					return yield* operation(() => readFile(filePath)).pipe(
						Effect.map((body) => ({ body })),
						Effect.orElseSucceed(() => null),
					);
				}),
			);
		},
		resolveAbsolutePath(key: string): string {
			const sanitized = sanitizeKey(key);
			return join(baseDir, sanitized);
		},
		ensureDirectoryForKey(key: string): Promise<string> {
			return runPromise(
				Effect.gen(function* () {
					const filePath = storage.resolveAbsolutePath(key);
					yield* fromResult(
						mkdir(dirname(filePath), { recursive: true }),
					);
					return filePath;
				}),
			);
		},
	};
	return storage;
}
