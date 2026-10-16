import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { PublicLandingPage } from "@hackkit/ui";
import { getAuthSession } from "@/lib/auth";
import { publicSiteConfig } from "@/lib/public-site-config";
export const dynamic = "force-dynamic";
export default function HomePage() {
	return runPromise(
		Effect.gen(function* () {
			const session = yield* fromResult(getAuthSession());
			const { signedInAction, ...landing } = publicSiteConfig.landing;
			return (
				<PublicLandingPage
					{...landing}
					primaryAction={
						session ? signedInAction : landing.primaryAction
					}
				/>
			);
		}),
	);
}
