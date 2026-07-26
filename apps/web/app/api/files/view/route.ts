import { NextResponse } from "next/server";
import { CorePermission } from "@hackkit/core";
import { getAuthSession } from "@/lib/auth";
import { auth } from "@/lib/auth";
import {
	getBlobStorage,
	isLocalBlobStorage,
	isS3BlobStorage,
} from "@/lib/blob";
import { hackkitHeaders } from "@/lib/hackkit-server";

function storedFileReferenceForKey(key: string): string {
	return `/api/files/view?key=${encodeURIComponent(key)}`;
}

async function canViewFile(key: string): Promise<boolean> {
	if (key.startsWith("profile-photos/")) return true;

	const session = await getAuthSession();
	if (!session) return false;

	const requestHeaders = await hackkitHeaders();
	const hacker = await auth.api.getHackkitHacker({ headers: requestHeaders });
	if (hacker?.resumeUrl === storedFileReferenceForKey(key)) return true;

	return (
		await auth.api.checkHackkitPermission({
			headers: requestHeaders,
			body: { permission: CorePermission.HackersView },
		})
	).allowed;
}

export async function GET(request: Request): Promise<NextResponse> {
	const url = new URL(request.url);
	const key = url.searchParams.get("key");
	if (!key) {
		return NextResponse.json({ error: "key is required" }, { status: 400 });
	}
	if (!key.startsWith("resumes/") && !key.startsWith("profile-photos/")) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (!(await canViewFile(key))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const storage = getBlobStorage();

	if (isS3BlobStorage(storage)) {
		const presignedUrl = await storage.getPresignedViewUrl(key);
		return NextResponse.redirect(presignedUrl);
	}

	if (isLocalBlobStorage(storage)) {
		const result = await storage.readObject({ key });
		if (!result) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		const body =
			result.body instanceof Uint8Array
				? result.body
				: Buffer.isBuffer(result.body)
					? result.body
					: Buffer.from(
							await new Response(result.body).arrayBuffer(),
						);
		return new NextResponse(body, {
			headers: {
				"Content-Type":
					result.contentType ?? "application/octet-stream",
			},
		});
	}

	return NextResponse.json({ error: "Not found" }, { status: 404 });
}
