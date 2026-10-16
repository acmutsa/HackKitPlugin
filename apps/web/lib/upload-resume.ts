import { Effect } from "effect";
import { runPromise, fromResult, boundaryError } from "@hackkit/core/effect";
function responseError(response: Response, fallback: string): Promise<Error> {
	return runPromise(
		Effect.gen(function* () {
			const body: unknown = yield* fromResult(response.json()).pipe(
				Effect.orElseSucceed(() => null),
			);
			const message =
				body &&
				typeof body === "object" &&
				"error" in body &&
				typeof body.error === "string"
					? body.error
					: fallback;
			return new Error(message);
		}),
	);
}
export function uploadResumeFile(file: File): Promise<string> {
	return runPromise(
		Effect.gen(function* () {
			if (file.type && file.type !== "application/pdf") {
				return yield* Effect.fail(
					boundaryError(
						new Error(
							"Choose a PDF resume before submitting your registration.",
						),
					),
				);
			}
			const registerResponse = yield* fromResult(
				fetch("/api/files/register", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						location: "resumes",
						fileName: file.name,
					}),
				}),
			);
			if (!registerResponse.ok) {
				return yield* Effect.fail(
					boundaryError(
						yield* fromResult(
							responseError(
								registerResponse,
								"Could not prepare your resume upload. Please sign in again and retry.",
							),
						),
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
						"Content-Type": file.type || "application/pdf",
					},
				}),
			);
			if (!uploadResponse.ok) {
				return yield* Effect.fail(
					boundaryError(
						yield* fromResult(
							responseError(
								uploadResponse,
								"Could not upload your resume. Check your connection and retry.",
							),
						),
					),
				);
			}
			return storedFileReference;
		}),
	);
}
