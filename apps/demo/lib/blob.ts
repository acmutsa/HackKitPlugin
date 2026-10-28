import "server-only";
import { env } from "cloudflare:workers";
import { env as settings } from "../env";

export const maximumUploadBytes = 10 * 1024 * 1024;

export function createUploadTarget(input: {
	ownerId: string;
	location: string;
	fileName: string;
}) {
	const extension = input.fileName
		.split(".")
		.pop()
		?.replace(/[^a-z0-9]/gi, "")
		.slice(0, 12);
	const key = `${input.location}/${input.ownerId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
	return {
		uploadUrl: `${settings.appUrl}/api/files/upload?key=${encodeURIComponent(key)}`,
		storedFileReference: `/api/files/view?key=${encodeURIComponent(key)}`,
	};
}

export function canUploadKey(key: string, ownerId: string) {
	return (
		["resumes", "profile-photos"].some((location) =>
			key.startsWith(`${location}/${ownerId}/`),
		) &&
		!key.includes("..") &&
		key.split("/").length === 3
	);
}

/** Read a bounded body even when a client omits Content-Length. */
export async function readUploadBody(request: Request) {
	const reader = request.body?.getReader();
	if (!reader) return new Uint8Array();
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			length += value.byteLength;
			if (length > maximumUploadBytes) {
				await reader.cancel();
				throw new RangeError("Files must be 10 MiB or smaller.");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

export function getBlobStorage() {
	return env.DEMO_UPLOADS;
}
