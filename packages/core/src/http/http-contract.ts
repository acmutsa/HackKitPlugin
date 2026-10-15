import type { BetterFetchResponse } from "@better-fetch/fetch";

export type ApiResult<T> = BetterFetchResponse<T>;
export type ApiError = NonNullable<ApiResult<never>["error"]>;
export type ApiErrorCode =
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "CONFLICT"
	| "FORBIDDEN"
	| "UNAUTHORIZED"
	| "INVALID_OPERATION"
	| "INTERNAL_SERVER_ERROR"
	| "UNSUPPORTED_MEDIA_TYPE"
	| "HTTP_ERROR";

type JsonDto<T> = T extends Date
	? string
	: T extends string | number | boolean | null | undefined
		? T
		: T extends readonly (infer Item)[]
			? Wire<Item>[]
			: T extends object
				? { [Key in keyof T]: JsonDto<T[Key]> }
				: T;
export type Wire<T> = T extends undefined | void ? null : JsonDto<T>;

/** Domain operations return plain DTOs. Serialize before returning so inferred endpoint types match JSON. */
export function toJsonDto<T>(value: T): Wire<T> {
	const json: unknown = JSON.parse(JSON.stringify(value ?? null));
	return json as Wire<T>;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
