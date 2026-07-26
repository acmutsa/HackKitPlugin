import type * as React from "react";
import { requireApprovalPendingAccess } from "@/lib/hackkit-server";

export const dynamic = "force-dynamic";

export default async function ApprovalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireApprovalPendingAccess();
	return children;
}
