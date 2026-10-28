import "server-only";
import { createLocalBlobStorage } from "@hackkit/blob-local";
import { env } from "../env";
let storage: ReturnType<typeof createLocalBlobStorage> | undefined;
export function getBlobStorage() {
	return (storage ??= createLocalBlobStorage({
		baseDir: env.localBlobBaseDir,
		appBaseUrl: env.appUrl,
		filesRoutePrefix: "/api/files",
	}));
}
