import { Cause, Effect, Schema } from "effect";
import { operation, originalError, runPromise } from "@hackkit/core/effect";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getBlobStorage } from "@/lib/blob";

const uploadInput = Schema.Struct({
	location: Schema.String.pipe(Schema.minLength(1)),
	fileName: Schema.String.pipe(Schema.minLength(1)),
});

export function POST(request: Request): Promise<NextResponse> {
	return runPromise(
		Effect.gen(function* () {
			const session = yield* operation(() => getAuthSession());
			if (!session)
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			return yield* Effect.gen(function* () {
				const input = yield* operation(() => request.json());
				const decoded = yield* Effect.either(
					Schema.decodeUnknown(uploadInput)(input),
				);
				if (decoded._tag === "Left")
					return NextResponse.json(
						{ error: "location and fileName are required" },
						{ status: 400 },
					);
				const body = decoded.right;
				if (!["resumes", "profile-photos"].includes(body.location))
					return NextResponse.json(
						{ error: "Unsupported upload location." },
						{ status: 400 },
					);
				const target = yield* operation(() =>
					getBlobStorage().getUploadTarget(body),
				);
				return NextResponse.json(target);
			}).pipe(
				Effect.catchAllCause((cause) =>
					Effect.sync(() => {
						const error = originalError(Cause.squash(cause));
						return NextResponse.json(
							{
								error:
									error instanceof Error
										? error.message
										: "Bad request",
							},
							{ status: 400 },
						);
					}),
				),
			);
		}),
	);
}
