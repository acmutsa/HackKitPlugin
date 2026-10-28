import Link from "next/link";
import { DemoActions } from "./demo-actions";

export const dynamic = "force-dynamic";

export default function HomePage() {
	return (
		<main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
			<p className="text-sm font-semibold uppercase tracking-widest text-primary">
				HackKit interactive demo
			</p>
			<h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
				A hackathon, from application to check-in.
			</h1>
			<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
				See what participants and organizers can do with HackKit.
				Explore a working event with fictional people, teams, and a
				schedule.
			</p>
			<section className="mt-12" aria-label="Choose a demo role">
				<DemoActions />
			</section>
			<aside className="mt-8 rounded-xl border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
				<p className="font-medium text-foreground">
					A shared demo with persistent sample data.
				</p>
				<p className="mt-2">
					Changes are visible to other visitors. Use fictional
					information only. Email delivery and Discord synchronization
					are disabled.
				</p>
			</aside>
			<div className="mt-8 flex flex-wrap gap-6 text-sm font-medium">
				<Link href="/schedule" className="underline underline-offset-4">
					Browse the event schedule
				</Link>
				<Link href="/sign-up" className="underline underline-offset-4">
					Try account signup
				</Link>
				<a
					href="https://hackkit-docs.acm-utsa.workers.dev"
					className="underline underline-offset-4"
				>
					Read the docs
				</a>
				<a
					href="https://github.com/acmutsa/HackKitPlugin"
					className="underline underline-offset-4"
				>
					View the source
				</a>
			</div>
		</main>
	);
}
