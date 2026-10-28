"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { demoAccounts, demoPassword } from "@/lib/demo-accounts";

export function DemoActions() {
	const [ready, setReady] = useState(false);
	const [pending, setPending] = useState<string>();
	useEffect(() => setReady(true), []);
	const [error, setError] = useState<string>();
	async function enter(role: "participant" | "organizer" | "newcomer") {
		setPending(role);
		setError(undefined);
		try {
			await authClient.signOut();
			const result =
				role === "newcomer"
					? await authClient.signUp.email({
							name: "Demo participant",
							email: `demo-${crypto.randomUUID()}@example.com`,
							password: demoPassword,
						})
					: await authClient.signIn.email({
							email: demoAccounts[role].email,
							password: demoPassword,
						});
			if (result.error)
				throw new Error(result.error.message ?? "Unable to open demo.");
			window.location.assign(
				role === "organizer" ? "/admin" : "/dashboard",
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Unable to open demo.",
			);
			setPending(undefined);
		}
	}
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-3">
				{(
					[
						[
							"participant",
							"Explore as a participant",
							"Open a registered hacker’s dashboard, create a team, and manage your event pass.",
						],
						[
							"organizer",
							"Explore as an organizer",
							"Review applications, manage roles and settings, and edit the event schedule.",
						],
						[
							"newcomer",
							"Try registration",
							"Create a fresh fictional account and walk through the onboarding forms.",
						],
					] as const
				).map(([role, title, description]) => (
					<button
						key={role}
						onClick={() => enter(role)}
						disabled={!ready || !!pending}
						className="rounded-xl border bg-card p-6 text-left shadow-sm transition hover:border-primary hover:bg-accent disabled:opacity-60"
					>
						<span className="block font-semibold">
							{pending === role ? "Opening your demo…" : title}
						</span>
						<span className="mt-3 block text-sm leading-relaxed text-muted-foreground">
							{description}
						</span>
					</button>
				))}
			</div>
			{error && (
				<p role="alert" className="mt-4 text-destructive">
					{error}
				</p>
			)}
		</>
	);
}
