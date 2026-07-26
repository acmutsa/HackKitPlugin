"use server";

import { CoreSetting } from "@hackkit/core";
import { actionFailure, actionSuccess } from "@hackkit/ui/actions";
import {
	type HackKitUIActions,
	resolveEventPassTargetAuthId,
} from "@hackkit/ui";
import { auth } from "@/lib/auth";
import { getHackkitSetting, hackkitHeaders } from "@/lib/hackkit-server";

type ActionName = keyof HackKitUIActions;
type Args<K extends ActionName> = Parameters<HackKitUIActions[K]>;

async function perform<T>(operation: () => Promise<T>, fallback: string) {
	try {
		return actionSuccess(await operation());
	} catch (error) {
		return actionFailure(error, fallback);
	}
}

function eventBody(values: Args<"createEvent">[0]) {
	return {
		title: values.title,
		description: values.description,
		startTime: new Date(values.startTime),
		endTime: new Date(values.endTime),
		location: values.location,
		type: values.type,
		host: values.host.trim() || undefined,
		hidden: values.hidden,
	};
}

async function scanTarget(rawQr: string) {
	const ttl = Number(await getHackkitSetting(CoreSetting.EventPassQrTtlMs));
	return resolveEventPassTargetAuthId(rawQr, new Date(), ttl);
}

export async function completeUserData(...[values]: Args<"completeUserData">) {
	return perform(async () => {
		await auth.api.completeHackkitUserData({
			headers: await hackkitHeaders(),
			body: values,
		});
	}, "Could not save user data.");
}

export async function claimHackTag(...[values]: Args<"claimHackTag">) {
	return perform(async () => {
		await auth.api.claimHackkitTag({
			headers: await hackkitHeaders(),
			body: values,
		});
	}, "Could not claim HackTag.");
}

export async function updateUserProfile(
	...[values]: Args<"updateUserProfile">
) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.updateHackkitProfile({ headers, body: values }),
			),
		"Could not update profile.",
	);
}

async function withHeaders<T>(operation: (headers: Headers) => Promise<T>) {
	return operation(await hackkitHeaders());
}

export async function registerHacker(...[values]: Args<"registerHacker">) {
	return perform(async () => {
		await auth.api.registerHackkitHacker({
			headers: await hackkitHeaders(),
			body: values,
		});
	}, "Could not complete hacker registration.");
}

export async function createEvent(...[values]: Args<"createEvent">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.createHackkitEvent({
					headers,
					body: eventBody(values),
				}),
			),
		"Could not create event.",
	);
}

export async function updateEvent(...[eventId, values]: Args<"updateEvent">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.updateHackkitEvent({
					headers,
					body: { eventId, ...eventBody(values) },
				}),
			),
		"Could not update event.",
	);
}

export async function deleteEvent(...[eventId]: Args<"deleteEvent">) {
	return perform(async () => {
		await auth.api.deleteHackkitEvent({
			headers: await hackkitHeaders(),
			body: { eventId },
		});
	}, "Could not delete event.");
}

export async function previewEventPassQr(
	...[input]: Args<"previewEventPassQr">
) {
	return perform(async () => {
		const targetAuthId = await scanTarget(input.rawQr);
		return auth.api.previewHackkitScan({
			headers: await hackkitHeaders(),
			body: { eventId: input.eventId, targetAuthId },
		});
	}, "Could not read Event Pass QR code.");
}

export async function recordEventScan(...[input]: Args<"recordEventScan">) {
	return perform(async () => {
		const targetAuthId = await scanTarget(input.rawQr);
		return auth.api.recordHackkitEventScan({
			headers: await hackkitHeaders(),
			body: { eventId: input.eventId, targetAuthId },
		});
	}, "Could not record scan.");
}

export async function checkInUser(...[input]: Args<"checkInUser">) {
	return perform(async () => {
		const targetAuthId = await scanTarget(input.rawQr);
		return auth.api.checkInHackkitUser({
			headers: await hackkitHeaders(),
			body: { targetAuthId },
		});
	}, "Could not check in participant.");
}

export async function clearCheckIn(...[targetAuthId]: Args<"clearCheckIn">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.clearHackkitUserCheckIn({
					headers,
					body: { targetAuthId },
				}),
			),
		"Could not clear check-in.",
	);
}

export async function confirmRsvp(..._args: Args<"confirmRsvp">) {
	return perform(
		() =>
			withHeaders((headers) => auth.api.confirmHackkitRsvp({ headers })),
		"Could not confirm RSVP.",
	);
}

export async function cancelRsvp(...[targetAuthId]: Args<"cancelRsvp">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.cancelHackkitRsvp({ headers, body: { targetAuthId } }),
			),
		"Could not cancel RSVP.",
	);
}

export async function setRsvpStatus(...[input]: Args<"setRsvpStatus">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.setHackkitRsvpStatus({ headers, body: input }),
			),
		"Could not update RSVP.",
	);
}

export async function promoteRsvp(...[targetAuthId]: Args<"promoteRsvp">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.promoteHackkitRsvp({
					headers,
					body: { targetAuthId },
				}),
			),
		"Could not promote RSVP.",
	);
}

export async function approveUser(...[input]: Args<"approveUser">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.approveHackkitUser({ headers, body: input }),
			),
		"Could not update approval.",
	);
}

export async function banUser(...[input]: Args<"banUser">) {
	return perform(async () => {
		await auth.api.banHackkitUser({
			headers: await hackkitHeaders(),
			body: input,
		});
	}, "Could not suspend user.");
}

export async function unbanUser(...[targetAuthId]: Args<"unbanUser">) {
	return perform(async () => {
		await auth.api.unbanHackkitUser({
			headers: await hackkitHeaders(),
			body: { targetAuthId },
		});
	}, "Could not reinstate user.");
}

export async function assignRoleToUser(...[input]: Args<"assignRoleToUser">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.assignHackkitRole({ headers, body: input }),
			),
		"Could not assign role.",
	);
}

export async function createRole(...[input]: Args<"createRole">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.createHackkitRole({ headers, body: input }),
			),
		"Could not create role.",
	);
}

export async function updateRole(...[input]: Args<"updateRole">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.updateHackkitRole({ headers, body: input }),
			),
		"Could not update role.",
	);
}

export async function deleteRole(...[roleId]: Args<"deleteRole">) {
	return perform(async () => {
		await auth.api.deleteHackkitRole({
			headers: await hackkitHeaders(),
			body: { roleId },
		});
	}, "Could not delete role.");
}

export async function listSettings(..._args: Args<"listSettings">) {
	return perform(
		() =>
			withHeaders((headers) => auth.api.listHackkitSettings({ headers })),
		"Could not load settings.",
	);
}

export async function setSettings(...[values]: Args<"setSettings">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.setManyHackkitSettings({
					headers,
					body: { values: [...values] },
				}),
			),
		"Could not save settings.",
	);
}

export async function resetSetting(...[key]: Args<"resetSetting">) {
	return perform(
		() =>
			withHeaders((headers) =>
				auth.api.resetHackkitSetting({ headers, body: { key } }),
			),
		"Could not reset setting.",
	);
}
