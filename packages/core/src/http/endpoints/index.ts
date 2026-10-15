import { resolveUserDataOptions } from "../../user-data-options";
import type { RequestRunner } from "../mutation";
import { createUserEndpoints } from "./users";
import { createRegistrationEndpoints } from "./registration";
import { createEventEndpoints } from "./events";
import { createRsvpEndpoints } from "./rsvp";
import { createRoleEndpoints } from "./roles";
import { createSettingEndpoints } from "./settings";
import { createEventPassEndpoints } from "./event-pass";

/** Compose the package-owned browser operations. Authentication stays in the shared runner. */
export function createCoreEndpoints(
	run: RequestRunner,
	userDataOptions = resolveUserDataOptions(),
) {
	return {
		...createUserEndpoints(run),
		...createRegistrationEndpoints(run, userDataOptions),
		...createEventEndpoints(run),
		...createRsvpEndpoints(run),
		...createRoleEndpoints(run),
		...createSettingEndpoints(run),
		...createEventPassEndpoints(run),
	};
}
