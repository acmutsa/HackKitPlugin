import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { AuthForm } from "./auth-form";
export const dynamic = "force-dynamic";
export default function SignInPage() {
	return runPromise(
		Effect.gen(function* () {
			const session = yield* fromResult(getAuthSession());
			if (session) redirect("/");
			return (
				<main className="min-h-screen bg-muted/30 px-6 py-10">
					<div className="mx-auto max-w-md space-y-6">
						<div className="space-y-2 text-center">
							<p className="text-sm font-medium text-primary">
								HackKit UI test app
							</p>
							<h1 className="text-3xl font-bold tracking-tight">
								Sign in
							</h1>
						</div>
						<AuthForm mode="sign-in" />
					</div>
				</main>
			);
		}),
	);
}
