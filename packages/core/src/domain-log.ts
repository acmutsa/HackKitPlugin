import { HackKitError } from "./errors.js";
import type {
	DomainLogContext,
	HackKitLogger,
	LogLevel,
} from "./adapters/logger.js";
import { logDomain } from "./adapters/logger.js";

export async function withDomainLog<T>(
	logger: HackKitLogger,
	action: string,
	context: Omit<DomainLogContext, "outcome" | "errorCode" | "errorMessage">,
	run: () => Promise<T>,
	options?: { successLevel?: LogLevel; errorLevel?: LogLevel },
): Promise<T> {
	const successLevel = options?.successLevel ?? "info";
	const errorLevel = options?.errorLevel ?? "warn";

	try {
		const result = await run();
		logDomain(logger, successLevel, action, {
			...context,
			outcome: "success",
		});
		return result;
	} catch (error) {
		if (error instanceof HackKitError) {
			logDomain(logger, errorLevel, action, {
				...context,
				outcome: "error",
				errorCode: error.code,
				errorMessage: error.message,
			});
		} else {
			logDomain(logger, "error", action, {
				...context,
				outcome: "error",
				errorMessage:
					error instanceof Error ? error.message : "Unknown error",
			});
		}
		throw error;
	}
}
