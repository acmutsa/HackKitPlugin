"use client";
import { HackKitUIProvider } from "@hackkit/ui";
import { createHackkitClient } from "@hackkit/core/http/client";
import type * as React from "react";

const hackkitClient = createHackkitClient();

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<HackKitUIProvider client={hackkitClient}>{children}</HackKitUIProvider>
	);
}
