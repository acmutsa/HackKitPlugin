"use client";
import * as React from "react";
import { toast } from "sonner";
import type { ApiError } from "@hackkit/core/client";

export function showHackkitError(error: ApiError) {
	if (error.status === 401) {
		toast.error(
			"Your session expired. Sign in, then retry without leaving this form.",
			{
				duration: Infinity,
				description: (
					<a
						href="/sign-in"
						target="_blank"
						rel="noopener noreferrer"
						className="underline"
					>
						Sign in in a new tab
					</a>
				),
			},
		);
		return;
	}
	toast.error(
		error.statusText === "Fetch Error"
			? "Could not reach the server. Please try again."
			: (error.message ?? "The request failed."),
	);
}
