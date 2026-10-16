"use client";

import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import { showHackkitError } from "../http-error";

import { type User, type Wire } from "@hackkit/core/client";
import { Scanner } from "@yudiel/react-qr-scanner";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "../lib/cn";
import { useHackKitUI } from "../provider";
import { type CheckInScannerProps } from "../types";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

export function CheckInScanner({ className, onDone }: CheckInScannerProps) {
	const { client, navigation } = useHackKitUI();
	const [loading, setLoading] = React.useState(false);
	const [rawQr, setRawQr] = React.useState<string | null>(null);
	const [targetUser, setTargetUser] = React.useState<Wire<User> | null>(null);

	function handleScan(rawValue: string) {
		return runPromise(
			Effect.gen(function* () {
				if (rawQr) return;

				setLoading(true);
				const result = yield* fromResult(
					client("@post/event-pass/preview", {
						body: { rawQr: rawValue },
					}),
				);
				setLoading(false);

				if (result.error) {
					showHackkitError(result.error);
					return;
				}

				setRawQr(rawValue);
				setTargetUser(result.data.user);
			}),
		);
	}

	function handleCheckIn() {
		return runPromise(
			Effect.gen(function* () {
				if (!rawQr) return;

				setLoading(true);
				const result = yield* fromResult(
					client("@post/users/check-in", {
						body: { rawQr },
					}),
				);
				setLoading(false);

				if (result.error) {
					showHackkitError(result.error);
					return;
				}

				toast.success("Participant checked in.");
				setRawQr(null);
				setTargetUser(null);
				onDone?.();
				navigation.refresh();
			}),
		);
	}

	function handleClearCheckIn() {
		return runPromise(
			Effect.gen(function* () {
				if (!targetUser) return;

				setLoading(true);
				const result = yield* fromResult(
					client("@post/users/clear-check-in", {
						body: {
							targetAuthId: targetUser.id,
						},
					}),
				);
				setLoading(false);

				if (result.error) {
					showHackkitError(result.error);
					return;
				}

				toast.success("Check-in cleared.");
				setRawQr(null);
				setTargetUser(null);
				onDone?.();
				navigation.refresh();
			}),
		);
	}

	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-lg flex-col gap-6",
				className,
			)}
		>
			<Card>
				<CardHeader>
					<CardTitle>Hackathon Check-in</CardTitle>
					<CardDescription>
						Scan a participant&apos;s Event Pass QR code once at
						arrival.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="aspect-square w-full overflow-hidden rounded-lg border">
						<Scanner
							onScan={(results) => {
								if (rawQr || results.length === 0) return;
								void handleScan(results[0]!.rawValue);
							}}
						/>
					</div>
				</CardContent>
			</Card>

			{targetUser ? (
				<Card>
					<CardHeader>
						<CardTitle>{targetUser.name}</CardTitle>
						<CardDescription>{targetUser.email}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{targetUser.checkedInAt ? (
							<div className="space-y-3">
								<p className="text-sm font-medium text-emerald-700">
									Already checked in.
								</p>
								<Button
									type="button"
									variant="outline"
									onClick={handleClearCheckIn}
									disabled={loading}
								>
									Clear check-in
								</Button>
							</div>
						) : (
							<div className="flex gap-2">
								<Button
									type="button"
									onClick={handleCheckIn}
									disabled={loading}
								>
									{loading ? "Saving..." : "Check in"}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setRawQr(null);
										setTargetUser(null);
										onDone?.();
									}}
								>
									Cancel
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
