import { Effect } from "effect";
import { runPromise, fromResult, boundaryError } from "@hackkit/core/effect";
export function uploadProfilePhotoFile(file: File): Promise<string> {
	return runPromise(
		Effect.gen(function* () {
			const registerResponse = yield* fromResult(
				fetch("/api/files/register", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "profile-photos",
						fileName: file.name,
					}),
				}),
			);
			if (!registerResponse.ok) {
				return yield* Effect.fail(
					boundaryError(
						new Error("Could not prepare profile photo upload."),
					),
				);
			}
			const { uploadUrl, storedFileReference } = (yield* fromResult(
				registerResponse.json(),
			)) as {
				uploadUrl: string;
				storedFileReference: string;
			};
			const uploadResponse = yield* fromResult(
				fetch(uploadUrl, {
					method: "PUT",
					body: file,
					headers: {
						"Content-Type": file.type || "application/octet-stream",
					},
				}),
			);
			if (!uploadResponse.ok) {
				return yield* Effect.fail(
					boundaryError(new Error("Could not upload profile photo.")),
				);
			}
			return storedFileReference;
		}),
	);
}
