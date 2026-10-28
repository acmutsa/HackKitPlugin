import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canUploadKey, getBlobStorage, readUploadBody } from "@/lib/blob";

export async function PUT(request: Request) {
	const session = await getAuthSession();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const key = new URL(request.url).searchParams.get("key");
	if (!key || !canUploadKey(key, session.user.id))
		return NextResponse.json(
			{ error: "Unsupported upload key." },
			{ status: 403 },
		);
	try {
		const body = await readUploadBody(request);
		const contentType =
			request.headers.get("content-type") ?? "application/octet-stream";
		if (
			key.startsWith("profile-photos/") &&
			!["image/png", "image/jpeg", "image/webp"].includes(contentType)
		)
			return NextResponse.json(
				{ error: "Choose a PNG, JPEG, or WebP image." },
				{ status: 400 },
			);
		await getBlobStorage().put(key, body, {
			httpMetadata: { contentType },
		});
		return new NextResponse(null, { status: 204 });
	} catch (error) {
		if (error instanceof RangeError)
			return NextResponse.json({ error: error.message }, { status: 413 });
		throw error;
	}
}
