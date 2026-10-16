import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { notFound } from "next/navigation";
import { PublicProfileCard } from "@hackkit/ui";
import { getHackkit } from "@/lib/runtime";
export const dynamic = "force-dynamic";
export default function PublicUserProfilePage({
	params,
}: {
	params: {
		tag: string;
	};
}) {
	return runPromise(
		Effect.gen(function* () {
			const tag = decodeURIComponent(params.tag);
			const profile = yield* fromResult(
				(yield* fromResult(
					getHackkit(),
				)).users.getPublicProfileByHackTag(tag),
			);
			if (!profile) notFound();
			return (
				<main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-6 py-10">
					<PublicProfileCard profile={profile} />
				</main>
			);
		}),
	);
}
