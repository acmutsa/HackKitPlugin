import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { HackKitError } from "@hackkit/core";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getRuntime } from "@/lib/runtime";
function escapeCsv(value: unknown): string {
	if (value === null || value === undefined) return "";
	const stringValue =
		value instanceof Date
			? value.toISOString()
			: typeof value === "string"
				? value
				: String(value);
	if (/[",\n\r]/.test(stringValue)) {
		return `"${stringValue.replaceAll('"', '""')}"`;
	}
	return stringValue;
}
function toCsv(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return "";
	const headers = Object.keys(rows[0] ?? {});
	const body = rows.map((row) =>
		headers.map((header) => escapeCsv(row[header])).join(","),
	);
	return [headers.join(","), ...body].join("\r\n");
}
export function GET() {
	return runPromise(
		Effect.gen(function* () {
			const session = yield* fromResult(getAuthSession());
			if (!session) {
				return NextResponse.json(
					{ error: "Unauthorized" },
					{ status: 401 },
				);
			}
			const runtime = yield* fromResult(getRuntime());
			const actor = yield* fromResult(runtime.getCurrentUser());
			const rows = yield* fromResult(
				runtime.hackkit.admin.exportUsers({ actorAuthId: actor.id }),
			).pipe(
				Effect.catchAll((error) =>
					error instanceof HackKitError && error.code === "FORBIDDEN"
						? Effect.succeed(null)
						: Effect.fail(error),
				),
			);
			if (!rows)
				return NextResponse.json(
					{ error: "Forbidden" },
					{ status: 403 },
				);
			const csv = toCsv(rows);
			const timestamp = new Date().toISOString().replaceAll(":", "-");
			return new NextResponse(csv, {
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="hackkit-users-${timestamp}.csv"`,
				},
			});
		}),
	);
}
