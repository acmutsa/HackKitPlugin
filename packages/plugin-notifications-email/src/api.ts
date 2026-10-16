import {
	promiseApi,
	promiseFunction,
	type BoundaryError,
} from "@hackkit/core/effect";
import { Effect } from "effect";
import { runPromise, fromResult } from "@hackkit/core/effect";
import {
	type HackKitPluginContext,
	type NotificationChannel,
	type NotificationDeliveryResult,
	type NotificationIntent,
} from "@hackkit/core";

import { mergeEmailTemplates, type EmailTemplateMap } from "./templates";
export type EmailMessage = {
	to: string;
	from: string;
	replyTo?: string;
	subject: string;
	text: string;
	html?: string;
};
export type EmailProviderResult = {
	id?: string;
	metadata?: Record<string, unknown>;
};
export type EmailProvider = {
	id: string;
	send(message: EmailMessage): Promise<EmailProviderResult>;
};
export type EmailRecipient = {
	email: string;
	name?: string;
};
export type EmailRecipientResolver = (
	intent: NotificationIntent,
	context: HackKitPluginContext,
) => Promise<EmailRecipient | null>;
export type EmailNotificationsPluginOptions = {
	provider?: EmailProvider;
	from: string;
	replyTo?: string;
	appName?: string;
	baseUrl?: string;
	templates?: EmailTemplateMap;
	resolveRecipient?: EmailRecipientResolver;
};
function defaultRecipientResolver(
	intent: NotificationIntent,
	context: HackKitPluginContext,
): Promise<EmailRecipient | null> {
	return runPromise(
		Effect.gen(function* () {
			const authId =
				intent.recipientAuthId ??
				(typeof intent.payload.authId === "string"
					? intent.payload.authId
					: undefined);
			if (!authId) return null;
			const user = yield* fromResult(context.getUser(authId));
			if (!user) return null;
			return {
				email: user.email,
				name: user.name,
			};
		}),
	);
}
function formatRecipient(recipient: EmailRecipient): string {
	if (!recipient.name) return recipient.email;
	return `${recipient.name} <${recipient.email}>`;
}
export function createEmailNotificationsEffects(
	context: HackKitPluginContext,
	options: EmailNotificationsPluginOptions,
) {
	const templates = mergeEmailTemplates(options.templates);
	const resolveRecipient =
		options.resolveRecipient ?? defaultRecipientResolver;
	const effectChannel = {
		id: "email",
		deliver(
			intent: NotificationIntent,
		): Effect.Effect<NotificationDeliveryResult, BoundaryError> {
			return Effect.gen(function* () {
				if (!options.provider) {
					return {
						status: "skipped",
						error: "Email notification provider is not configured.",
					};
				}
				const template = templates[intent.kind];
				if (!template) {
					return {
						status: "skipped",
						error: `No email template is registered for '${intent.kind}'.`,
					};
				}
				const recipient = yield* fromResult(
					resolveRecipient(intent, context),
				);
				if (!recipient) {
					return {
						status: "skipped",
						error: "Email recipient could not be resolved.",
					};
				}
				const rendered = yield* fromResult(
					template({
						intent,
						payload: intent.payload,
						appName: options.appName ?? "HackKit",
						baseUrl: options.baseUrl,
					}),
				);
				if (!rendered) {
					return {
						status: "skipped",
						recipient: recipient.email,
						provider: options.provider.id,
					};
				}
				const result = yield* fromResult(
					options.provider.send({
						to: formatRecipient(recipient),
						from: options.from,
						replyTo: options.replyTo,
						subject: rendered.subject,
						text: rendered.text,
						html: rendered.html,
					}),
				);
				return {
					status: "delivered",
					provider: options.provider.id,
					recipient: recipient.email,
					externalId: result.id,
					metadata: result.metadata,
				};
			});
		},
	};
	const channel: NotificationChannel = {
		id: effectChannel.id,
		deliver: promiseFunction(effectChannel.deliver),
	};
	return {
		channel,
		deliverPending(
			input: {
				limit?: number;
			} = {},
		) {
			return Effect.suspend(() =>
				fromResult(
					context.notifications.deliverPending({
						channels: [channel],
						limit: input.limit,
					}),
				),
			);
		},
		deliverIntent(intentId: string) {
			return Effect.gen(function* () {
				const intent = yield* fromResult(
					context.notifications.getIntent(intentId),
				);
				if (!intent) {
					return null;
				}
				const result = yield* fromResult(effectChannel.deliver(intent));
				return yield* fromResult(
					context.notifications.recordDeliveryAttempt({
						intentId,
						channel: channel.id,
						...result,
					}),
				);
			});
		},
	};
}
export type EmailNotificationsApi = ReturnType<
	typeof createEmailNotificationsApi
>;

export function createEmailNotificationsApi(
	context: HackKitPluginContext,
	options: EmailNotificationsPluginOptions,
) {
	return promiseApi(createEmailNotificationsEffects(context, options));
}
