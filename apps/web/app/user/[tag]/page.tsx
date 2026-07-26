import { notFound } from "next/navigation";
import { PublicProfileCard } from "@hackkit/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PublicUserProfilePage({
	params,
}: {
	params: { tag: string };
}) {
	const tag = decodeURIComponent(params.tag);
	const profile = await auth.api.getHackkitPublicProfile({
		body: { hackTag: tag },
	});
	if (!profile) notFound();

	return (
		<main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-6 py-10">
			<PublicProfileCard profile={profile} />
		</main>
	);
}
