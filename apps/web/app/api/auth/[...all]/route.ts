import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { getAuth } from "@/lib/auth";

export function GET(request: Request) {
	return runPromise(
		Effect.gen(function* () {
			return yield* fromResult(
				(yield* fromResult(getAuth())).handler(request),
			);
		}),
	);
}

export function POST(request: Request) {
	return runPromise(
		Effect.gen(function* () {
			return yield* fromResult(
				(yield* fromResult(getAuth())).handler(request),
			);
		}),
	);
}
