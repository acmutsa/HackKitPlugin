/** Browser-safe validation, constants, and domain DTO types. No ORM initialization. */
export { HackKitError, hackKitErrorCodes } from "./errors";
export type { HackKitErrorCode } from "./errors";
export { CorePermission, hasPermission, hasSuperAdmin } from "./permissions";
export * from "./schemas";
export * from "./settings";
export * from "./user-data-options";
export * from "./event-types";
export * from "./groups";
export type * from "./types";
export type { RsvpSummary } from "./functions/rsvp";
