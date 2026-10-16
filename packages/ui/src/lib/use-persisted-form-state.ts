"use client";
import { Effect } from "effect";
import { runSync } from "@hackkit/core/effect";

import * as React from "react";
import { type FieldValues, type UseFormReturn } from "react-hook-form";

function jsonReplacer(_key: string, value: unknown) {
	if (typeof value === "number" && !Number.isFinite(value)) {
		return undefined;
	}
	return value;
}

export function usePersistedFormState<TValues extends FieldValues>(
	form: UseFormReturn<TValues>,
	storageKey?: string,
) {
	const [hydrated, setHydrated] = React.useState(false);

	React.useEffect(() => {
		if (!storageKey) {
			setHydrated(true);
			return;
		}

		runSync(
			Effect.try(() => {
				const stored = window.localStorage.getItem(storageKey);
				if (stored) {
					const values = JSON.parse(stored) as Partial<TValues>;
					form.reset({ ...form.getValues(), ...values });
				}
			}).pipe(
				Effect.ignore,
				Effect.ensuring(Effect.sync(() => setHydrated(true))),
			),
		);
	}, [form, storageKey]);

	React.useEffect(() => {
		if (!storageKey || !hydrated) return;

		const subscription = form.watch((values) => {
			runSync(
				Effect.try(() => {
					window.localStorage.setItem(
						storageKey,
						JSON.stringify(values, jsonReplacer),
					);
				}).pipe(Effect.ignore),
			);
		});

		return () => subscription.unsubscribe();
	}, [form, hydrated, storageKey]);

	return React.useCallback(() => {
		if (!storageKey) return;
		runSync(
			Effect.try(() => window.localStorage.removeItem(storageKey)).pipe(
				Effect.ignore,
			),
		);
	}, [storageKey]);
}
