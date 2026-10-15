"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, useHackkitClient, showHackkitError } from "@hackkit/ui";
import type { TeamsEndpoints } from "../client";

export function TeamCreateForm() {
	const client = useHackkitClient<TeamsEndpoints>();
	const router = useRouter();
	const [name, setName] = React.useState("");
	const [tag, setTag] = React.useState("");
	const [pending, setPending] = React.useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		const result = await client("@post/teams/create", {
			body: { name, tag },
		});
		setPending(false);
		if (result.error) {
			showHackkitError(result.error);
			return;
		}
		toast.success("Team created.");
		router.refresh();
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-lg border bg-card p-6 shadow-sm"
		>
			<div className="space-y-2">
				<h2 className="text-xl font-semibold">Create a team</h2>
				<p className="text-sm text-muted-foreground">
					Start a competition team and invite other Hackers.
				</p>
			</div>
			<label className="block space-y-1 text-sm">
				<span className="font-medium">Team name</span>
				<input
					className="flex h-10 w-full rounded-md border bg-background px-3 py-2"
					value={name}
					onChange={(event) => setName(event.target.value)}
					required
				/>
			</label>
			<label className="block space-y-1 text-sm">
				<span className="font-medium">Team tag</span>
				<input
					className="flex h-10 w-full rounded-md border bg-background px-3 py-2"
					value={tag}
					onChange={(event) => setTag(event.target.value)}
					required
				/>
			</label>
			<Button type="submit" disabled={pending}>
				{pending ? "Creating..." : "Create team"}
			</Button>
		</form>
	);
}
