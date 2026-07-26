import type * as React from "react";
import { requireParticipantAccess } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function ParticipantLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireParticipantAccess();
	return children;
}
