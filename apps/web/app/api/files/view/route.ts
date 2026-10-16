import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { NextResponse } from "next/server";
import { CorePermission } from "@hackkit/core";
import { getAuthSession } from "@/lib/auth";
import {
	getBlobStorage,
	isLocalBlobStorage,
	isS3BlobStorage,
} from "@/lib/blob";
import { getRuntime } from "@/lib/runtime";
function storedFileReferenceForKey(key: string): string {
	return `/api/files/view?key=${encodeURIComponent(key)}`;
}
function canViewFile(key: string): Promise<boolean> {
	return runPromise(
		Effect.gen(function* () {
			if (key.startsWith("profile-photos/")) return true;
			const session = yield* fromResult(getAuthSession());
			if (!session) return false;
			const runtime = yield* fromResult(getRuntime());
			const currentUser = yield* fromResult(runtime.getCurrentUser());
			const hacker = yield* fromResult(
				runtime.hackkit.hackers.getHacker(currentUser.id),
			);
			if (hacker?.resumeUrl === storedFileReferenceForKey(key))
				return true;
			return yield* fromResult(
				runtime.hackkit.accessControl.hasPermission(
					currentUser.id,
					CorePermission.HackersView,
				),
			);
		}),
	);
}
export function GET(request: Request): Promise<NextResponse> {
	return runPromise(
		Effect.gen(function* () {
			const url = new URL(request.url);
			const key = url.searchParams.get("key");
			if (!key) {
				return NextResponse.json(
					{ error: "key is required" },
					{ status: 400 },
				);
			}
			if (
				!key.startsWith("resumes/") &&
				!key.startsWith("profile-photos/")
			) {
				return NextResponse.json(
					{ error: "Not found" },
					{ status: 404 },
				);
			}
			if (!(yield* fromResult(canViewFile(key)))) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}
			const storage = getBlobStorage();
			if (isS3BlobStorage(storage)) {
				const presignedUrl = yield* fromResult(
					storage.getPresignedViewUrl(key),
				);
				return NextResponse.redirect(presignedUrl);
			}
			if (isLocalBlobStorage(storage)) {
				const result = yield* fromResult(storage.readObject({ key }));
				if (!result) {
					return NextResponse.json(
						{ error: "Not found" },
						{ status: 404 },
					);
				}
				const body =
					result.body instanceof Uint8Array
						? Uint8Array.from(result.body).buffer
						: yield* fromResult(
								new Response(result.body).arrayBuffer(),
							);
				return new NextResponse(body, {
					headers: {
						"Content-Type":
							result.contentType ?? "application/octet-stream",
					},
				});
			}
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}),
	);
}
