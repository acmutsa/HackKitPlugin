import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { notFound } from "next/navigation";
import { DiscordSyncButton } from "../../src/components/discord-sync-button";
import { getHackkitRuntime } from "@hackkit/next";
import { type DiscordApi } from "../../src/api";
export const dynamic = "force-dynamic";
export default function DiscordPage() {
	return runPromise(
		Effect.gen(function* () {
			const runtime = yield* fromResult(getHackkitRuntime());
			if (!runtime.hackkit.isPluginEnabled("discord")) notFound();
			const currentUser = yield* fromResult(runtime.getCurrentUser());
			const discord = runtime.hackkit.plugins.discord as DiscordApi;
			const member = yield* fromResult(discord.getMember(currentUser.id));
			return (
				<main className="min-h-screen bg-muted/30 px-6 py-10">
					<div className="mx-auto max-w-3xl space-y-6">
						<div className="space-y-2">
							<p className="text-sm font-medium text-primary">
								Discord
							</p>
							<h1 className="text-3xl font-bold tracking-tight">
								Discord account
							</h1>
							<p className="text-muted-foreground">
								Link Discord to receive participant and Group
								roles in the event server.
							</p>
						</div>

						<section className="rounded-lg border bg-card p-6 shadow-sm">
							{member ? (
								<div className="space-y-4">
									<div>
										<h2 className="text-xl font-semibold">
											Linked
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											@{member.username} is linked to this
											HackKit account.
										</p>
										{member.lastRoleSyncAt ? (
											<p className="mt-1 text-xs text-muted-foreground">
												Last role sync:{" "}
												{member.lastRoleSyncAt.toLocaleString()}
											</p>
										) : null}
									</div>
									<DiscordSyncButton />
								</div>
							) : (
								<div>
									<h2 className="text-xl font-semibold">
										Not linked
									</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										Use the verification button in Discord
										to generate a secure link.
									</p>
								</div>
							)}
						</section>
					</div>
				</main>
			);
		}),
	);
}
