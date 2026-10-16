import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getBlobStorage, isLocalBlobStorage } from "@/lib/blob";
export function PUT(request: Request): Promise<NextResponse> {
	return runPromise(
		Effect.gen(function* () {
			const session = yield* fromResult(getAuthSession());
			if (!session) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}
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
					{ error: "Unsupported upload key." },
					{ status: 400 },
				);
			}
			const storage = getBlobStorage();
			if (!isLocalBlobStorage(storage)) {
				return NextResponse.json(
					{
						error: "Direct upload is only supported for local blob storage.",
					},
					{ status: 400 },
				);
			}
			const filePath = yield* fromResult(
				storage.ensureDirectoryForKey(key),
			);
			const body = new Uint8Array(
				yield* fromResult(request.arrayBuffer()),
			);
			yield* fromResult(writeFile(filePath, body));
			return new NextResponse(null, { status: 204 });
		}),
	);
}
