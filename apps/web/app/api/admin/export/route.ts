import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { hackkitHeaders } from "@/lib/hackkit-server";

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

export async function GET() {
	const session = await getAuthSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const rows = await auth.api.exportHackkitAdminUsers({
		headers: await hackkitHeaders(),
	});
	const csv = toCsv(rows);
	const timestamp = new Date().toISOString().replaceAll(":", "-");

	return new NextResponse(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="hackkit-users-${timestamp}.csv"`,
		},
	});
}
