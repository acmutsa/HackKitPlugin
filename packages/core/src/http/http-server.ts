import { Effect, Cause, Schema } from "effect";
import { runPromise, fromResult, operation, originalError } from "../effect";

import { APIError } from "better-call";
import { HackKitError, type HackKitErrorCode } from "../errors";
import { isRecord, type ApiErrorCode } from "./http-contract";
const domainStatus = {
	VALIDATION_ERROR: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	INVALID_OPERATION: 422,
} satisfies Record<HackKitErrorCode, number>;
function codeForStatus(status: number): ApiErrorCode {
	switch (status) {
		case 400:
			return "VALIDATION_ERROR";
		case 401:
			return "UNAUTHORIZED";
		case 403:
			return "FORBIDDEN";
		case 404:
			return "NOT_FOUND";
		case 409:
			return "CONFLICT";
		case 415:
			return "UNSUPPORTED_MEDIA_TYPE";
		case 422:
			return "INVALID_OPERATION";
		default:
			return status >= 500 ? "INTERNAL_SERVER_ERROR" : "HTTP_ERROR";
	}
}
function responseHeaders(source?: HeadersInit): Headers {
	const headers = new Headers(source);
	headers.delete("content-length");
	headers.delete("content-encoding");
	headers.set("content-type", "application/json");
	headers.set("cache-control", "no-store");
	return headers;
}
function errorResponse(
	status: number,
	code: ApiErrorCode,
	message: string,
	headers?: HeadersInit,
) {
	return Response.json(
		{ code, message },
		{ status, headers: responseHeaders(headers) },
	);
}
/** Domain failures stay useful; unexpected exception details stay on the server. */
export function httpError(error: unknown): Response {
	if (error instanceof HackKitError)
		return errorResponse(
			domainStatus[error.code],
			error.code,
			error.message,
		);
	if (error instanceof APIError && error.statusCode < 500) {
		return errorResponse(
			error.statusCode,
			codeForStatus(error.statusCode),
			error.body?.message ?? "The request failed.",
		);
	}
	return errorResponse(
		500,
		"INTERNAL_SERVER_ERROR",
		"Something went wrong. Please try again.",
	);
}
/** One response policy for the whole mounted handler, including router-level 404s. */
function finalizeResponse(response: Response): Promise<Response> {
	return runPromise(
		Effect.gen(function* () {
			const hasBody = response.body !== null;
			const text = yield* fromResult(response.text());
			if (response.ok) {
				const data: unknown = !hasBody
					? null
					: !text.length ||
						  response.headers
								.get("content-type")
								?.startsWith("text/plain")
						? text
						: JSON.parse(text);
				return Response.json(data, {
					status: response.status === 204 ? 200 : response.status,
					headers: responseHeaders(response.headers),
				});
			}
			const body: unknown = yield* Schema.decodeUnknown(
				Schema.parseJson(),
			)(text).pipe(Effect.orElseSucceed(() => null));
			const message =
				response.status >= 500
					? "Something went wrong. Please try again."
					: isRecord(body) && typeof body.message === "string"
						? body.message
						: response.status === 404
							? "Endpoint not found."
							: "The request failed.";
			return errorResponse(
				response.status,
				codeForStatus(response.status),
				message,
				response.headers,
			);
		}),
	);
}
/** Browser mutation endpoints require an explicit configured origin and JSON bodies. */
export function protectHttpHandler(
	handler: (request: Request) => Promise<Response>,
	options: {
		trustedOrigins: readonly string[];
		onUnexpectedError?: (error: unknown) => void;
	},
) {
	const execute = (request: Request): Promise<Response> =>
		runPromise(
			Effect.gen(function* () {
				if (request.method !== "GET" && request.method !== "HEAD") {
					const origin = request.headers.get("origin");
					if (
						!origin ||
						!options.trustedOrigins.includes(origin) ||
						request.headers.get("sec-fetch-site") === "cross-site"
					) {
						return errorResponse(
							403,
							"FORBIDDEN",
							"Request origin is not allowed.",
						);
					}
					const mediaType = request.headers
						.get("content-type")
						?.split(";")[0]
						.trim()
						.toLowerCase();
					// Next may expose an empty stream for a bodyless POST. Check its bytes
					// before requiring a content type; nonempty bodies still require JSON.
					const hasBody =
						request.body !== null &&
						(mediaType !== undefined ||
							(yield* fromResult(request.clone().arrayBuffer()))
								.byteLength > 0);
					if (request.body !== null && !hasBody) {
						request = new Request(request.url, {
							method: request.method,
							headers: request.headers,
							signal: request.signal,
						});
					}
					if (hasBody && mediaType !== "application/json") {
						return errorResponse(
							415,
							"UNSUPPORTED_MEDIA_TYPE",
							"Mutation bodies must use application/json.",
						);
					}
				}
				return yield* fromResult(
					finalizeResponse(yield* fromResult(handler(request))),
				);
			}),
		);
	return (request: Request): Promise<Response> =>
		runPromise(
			operation(() => execute(request)).pipe(
				Effect.catchAllCause((cause) =>
					Effect.sync(() => {
						const error = originalError(Cause.squash(cause));
						if (
							!(error instanceof APIError) &&
							!(error instanceof HackKitError)
						)
							options.onUnexpectedError?.(error);
						return httpError(error);
					}),
				),
			),
		);
}
