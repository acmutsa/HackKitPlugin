import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { createUploadTarget } from "@/lib/blob";

const upload = z.object({
	location: z.enum(["resumes", "profile-photos"]),
	fileName: z.string().min(1).max(255),
});
export async function POST(request: Request) {
	const session = await getAuthSession();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const input = upload.safeParse(await request.json().catch(() => null));
	if (!input.success)
		return NextResponse.json(
			{ error: "Choose a resume or profile photo and a file name." },
			{ status: 400 },
		);
	return NextResponse.json(
		createUploadTarget({ ...input.data, ownerId: session.user.id }),
	);
}
