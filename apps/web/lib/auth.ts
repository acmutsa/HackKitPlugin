import "server-only";
import { headers } from "next/headers";
import { getCoreRuntime } from "./runtime";

export async function getAuth() {
	return (await getCoreRuntime()).auth;
}

export async function getAuthSession() {
	return (await getAuth()).api.getSession({ headers: await headers() });
}
