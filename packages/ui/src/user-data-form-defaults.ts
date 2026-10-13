import type { UserData } from "@hackkit/core/client";
import type { UserDataFormValues } from "./types";

export function toUserDataFormDefaultValues(
	userData: UserData,
): UserDataFormValues {
	return {
		age: userData.age,
		gender: userData.gender,
		race: userData.race,
		ethnicity: userData.ethnicity,
		shirtSize: userData.shirtSize,
		dietaryRestrictions: userData.dietaryRestrictions,
		accommodationNote: userData.accommodationNote ?? "",
		phoneNumber: userData.phoneNumber ?? "",
		countryOfResidence: userData.countryOfResidence ?? undefined,
		hasAcceptedMLHCodeOfConduct: userData.hasAcceptedMLHCodeOfConduct,
		hasSharedDataWithMLH: userData.hasSharedDataWithMLH,
		isEmailable: userData.isEmailable,
	};
}
