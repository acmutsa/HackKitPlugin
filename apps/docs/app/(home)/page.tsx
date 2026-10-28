import Link from "next/link";
import { BookOpen, Puzzle, Terminal, ArrowRight } from "lucide-react";

export default function HomePage() {
	return (
		<main className="mx-auto w-full max-w-6xl px-6 py-20 md:py-32">
			<div className="border-fd-border bg-fd-muted text-fd-muted-foreground mb-6 inline-flex rounded-full border px-3 py-1 text-sm">
				Open source hackathon software
			</div>
			<h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
				Your event.
				<br />
				Your HackKit.
			</h1>
			<p className="text-fd-muted-foreground mt-7 max-w-2xl text-lg leading-relaxed">
				Build a hackathon portal around your event. Start with
				registration and profiles, then add teams, event operations, and
				the integrations you need.
			</p>
			<div className="mt-9 flex flex-wrap gap-4">
				<Link
					href="/docs/getting-started"
					className="bg-fd-primary text-fd-primary-foreground inline-flex items-center gap-2 rounded-lg px-5 py-3 font-medium"
				>
					Get started <ArrowRight size={16} />
				</Link>
				<Link
					href="/docs/demo"
					className="border-fd-border hover:bg-fd-accent rounded-lg border px-5 py-3 font-medium"
				>
					Explore the demo
				</Link>
			</div>
			<div className="mt-20 grid gap-6 md:grid-cols-3">
				{[
					{
						icon: Terminal,
						title: "Runnable templates",
						description:
							"Choose minimal Core registration or the full example. Run either locally with the workspace.",
						href: "/docs/templates",
					},
					{
						icon: Puzzle,
						title: "A shared Core, optional plugins",
						description:
							"Keep domain rules and permissions in Core. Configure features and pages in your application.",
						href: "/docs/architecture",
					},
					{
						icon: BookOpen,
						title: "Operate with confidence",
						description:
							"Use reviewed migrations, explicit roles, and integration checks against the actual templates.",
						href: "/docs/testing",
					},
				].map(({ icon: Icon, title, description, href }) => (
					<Link
						key={href}
						href={href}
						className="border-fd-border hover:bg-fd-accent rounded-xl border p-6 transition"
					>
						<Icon
							size={22}
							className="text-fd-muted-foreground mb-5"
						/>
						<h2 className="text-lg font-semibold">{title}</h2>
						<p className="text-fd-muted-foreground mt-3 text-sm leading-relaxed">
							{description}
						</p>
					</Link>
				))}
			</div>
		</main>
	);
}
