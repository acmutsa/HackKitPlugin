"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { DefaultHackKitLink } from "./components/default-hackkit-link";
import { DEFAULT_EVENT_PASS_QR_TTL_MS } from "./event-pass";
import {
	resolveHackKitUIRoutes,
	type HackKitNavigation,
	type HackKitUIRoutesInput,
} from "./navigation";
import {
	createHackkitClient,
	type HackkitClient,
	type HttpEndpoints,
} from "@hackkit/core/http/client";

type HackKitUIContextValue = {
	client: HackkitClient;
	navigation: HackKitNavigation;
	eventPassQrTtlMs: number;
};

const HackKitUIContext = React.createContext<HackKitUIContextValue | null>(
	null,
);

export type HackKitUIProviderProps = {
	client: HackkitClient;
	/**
	 * Full navigation adapter override. When omitted, HackKit UI uses the
	 * default Next.js App Router adapter with {@link routes} (or defaults).
	 */
	navigation?: HackKitNavigation;
	/**
	 * Partial route map override for the default Next adapter. Ignored when
	 * {@link navigation} is provided (pass routes on that object instead).
	 */
	routes?: HackKitUIRoutesInput;
	eventPassQrTtlMs?: number;
	children: React.ReactNode;
};

type ProviderShellProps = {
	client: HackkitClient;
	navigation: HackKitNavigation;
	eventPassQrTtlMs: number;
	children: React.ReactNode;
};

function HackKitUIProviderShell({
	client,
	navigation,
	eventPassQrTtlMs,
	children,
}: ProviderShellProps) {
	return (
		<HackKitUIContext.Provider
			value={{ client, navigation, eventPassQrTtlMs }}
		>
			{children}
			<Toaster richColors closeButton />
		</HackKitUIContext.Provider>
	);
}

function HackKitUIProviderWithDefaultNavigation({
	client,
	routes,
	eventPassQrTtlMs,
	children,
}: Omit<HackKitUIProviderProps, "navigation">) {
	const router = useRouter();
	const resolvedRoutes = React.useMemo(
		() => resolveHackKitUIRoutes(routes),
		[routes],
	);

	const navigation = React.useMemo(
		(): HackKitNavigation => ({
			push: (href) => {
				void router.push(href);
			},
			refresh: () => {
				router.refresh();
			},
			Link: DefaultHackKitLink,
			routes: resolvedRoutes,
		}),
		[resolvedRoutes, router],
	);

	return (
		<HackKitUIProviderShell
			client={client}
			navigation={navigation}
			eventPassQrTtlMs={eventPassQrTtlMs ?? DEFAULT_EVENT_PASS_QR_TTL_MS}
		>
			{children}
		</HackKitUIProviderShell>
	);
}

export function HackKitUIProvider({
	client,
	navigation,
	routes,
	eventPassQrTtlMs = DEFAULT_EVENT_PASS_QR_TTL_MS,
	children,
}: HackKitUIProviderProps) {
	if (navigation) {
		return (
			<HackKitUIProviderShell
				client={client}
				navigation={navigation}
				eventPassQrTtlMs={eventPassQrTtlMs}
			>
				{children}
			</HackKitUIProviderShell>
		);
	}

	return (
		<HackKitUIProviderWithDefaultNavigation
			client={client}
			routes={routes}
			eventPassQrTtlMs={eventPassQrTtlMs}
		>
			{children}
		</HackKitUIProviderWithDefaultNavigation>
	);
}

export function useHackKitUI(): HackKitUIContextValue {
	const context = React.useContext(HackKitUIContext);
	if (!context) {
		throw new Error(
			"HackKit UI components must be rendered inside HackKitUIProvider.",
		);
	}
	return context;
}

/** Convenience hook for the navigation seam only. */
export function useHackKitNavigation(): HackKitNavigation {
	return useHackKitUI().navigation;
}

/** Bind a plugin's type-only endpoints using the provider's HTTP settings. */
export function useHackkitClient<TEndpoints extends HttpEndpoints = {}>() {
	const { options } = useHackKitUI().client;
	return React.useMemo(
		() => createHackkitClient<TEndpoints>(options),
		[options],
	);
}
