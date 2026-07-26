import type * as React from "react";
import { requireOnboardingAccess } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireOnboardingAccess();
	return children;
}
