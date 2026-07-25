import type { BetterAuthClientPlugin } from "better-auth/client";
import type { hackkit } from "./index";

/** Add HackKit's inferred Better Auth endpoints to a Better Auth client. */
export function hackkitClient() {
	return {
		id: "hackkit",
		$InferServerPlugin: {} as ReturnType<typeof hackkit>,
	} satisfies BetterAuthClientPlugin;
}
