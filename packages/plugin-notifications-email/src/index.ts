import type { HackKitPlugin } from "@hackkit/core";
import {
	createEmailNotificationsApi,
	type EmailNotificationsPluginOptions,
} from "./api";

export function emailNotificationsPlugin(
	options:
		| EmailNotificationsPluginOptions
		| (() => EmailNotificationsPluginOptions),
): HackKitPlugin<
	"notificationsEmail",
	ReturnType<typeof createEmailNotificationsApi>
> {
	let resolvedOptions: EmailNotificationsPluginOptions | undefined;
	return {
		id: "notificationsEmail",
		packageName: "@hackkit/plugin-notifications-email",
		setup: (context) => {
			resolvedOptions ??=
				typeof options === "function" ? options() : options;
			return createEmailNotificationsApi(context, resolvedOptions);
		},
	};
}

export {
	createEmailNotificationsApi,
	type EmailMessage,
	type EmailNotificationsApi,
	type EmailNotificationsPluginOptions,
	type EmailProvider,
	type EmailProviderResult,
	type EmailRecipient,
	type EmailRecipientResolver,
} from "./api";
export {
	defaultEmailTemplates,
	mergeEmailTemplates,
	type EmailTemplate,
	type EmailTemplateContext,
	type EmailTemplateMap,
	type EmailTemplateRenderer,
} from "./templates";
export {
	createResendEmailProvider,
	createSmtpEmailProvider,
	type ResendEmailProviderOptions,
	type SmtpEmailProviderOptions,
} from "./providers";
