import { Effect, Schema } from "effect";
import {
	runPromise,
	fromResult,
	boundaryError,
	type BoundaryError,
} from "@hackkit/core/effect";
import net from "node:net";
import tls from "node:tls";
import { type EmailMessage, type EmailProvider } from "./api";
export type ResendEmailProviderOptions = {
	apiKey: string;
	endpoint?: string;
};
const resendResponseSchema = Schema.Struct({
	id: Schema.optional(Schema.String),
	error: Schema.optional(
		Schema.Struct({ message: Schema.optional(Schema.String) }),
	),
});
type ResendResponse = Schema.Schema.Type<typeof resendResponseSchema>;
function parseResendResponse(value: unknown): Effect.Effect<ResendResponse> {
	return Schema.decodeUnknown(resendResponseSchema)(value).pipe(
		Effect.orElseSucceed(() => ({})),
	);
}
export function createResendEmailProvider(
	options: ResendEmailProviderOptions,
): EmailProvider {
	return {
		id: "resend",
		send(message) {
			return runPromise(
				Effect.gen(function* () {
					const response = yield* fromResult(
						fetch(
							options.endpoint ?? "https://api.resend.com/emails",
							{
								method: "POST",
								headers: {
									Authorization: `Bearer ${options.apiKey}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									from: message.from,
									to: [message.to],
									reply_to: message.replyTo,
									subject: message.subject,
									text: message.text,
									html: message.html,
								}),
							},
						),
					);
					const json: unknown = yield* fromResult(
						response.json(),
					).pipe(Effect.orElseSucceed(() => ({})));
					const body = yield* parseResendResponse(json);
					if (!response.ok) {
						return yield* Effect.fail(
							boundaryError(
								new Error(
									body.error?.message ??
										`Resend email request failed with ${response.status}.`,
								),
							),
						);
					}
					return {
						id: body.id,
						metadata: { providerStatus: response.status },
					};
				}),
			);
		},
	};
}
export type SmtpEmailProviderOptions = {
	host: string;
	port?: number;
	secure?: boolean;
	username?: string;
	password?: string;
	heloName?: string;
};
type Socket = net.Socket | tls.TLSSocket;
function encodeBase64(value: string): string {
	return Buffer.from(value, "utf8").toString("base64");
}
function encodeHeader(value: string): string {
	if (/^[\x20-\x7e]*$/.test(value)) return value;
	return `=?UTF-8?B?${encodeBase64(value)}?=`;
}
function normalizeAddress(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return (match?.[1] ?? value).trim();
}
function buildSmtpMessage(message: EmailMessage): string {
	const headers = [
		`From: ${message.from}`,
		`To: ${message.to}`,
		message.replyTo ? `Reply-To: ${message.replyTo}` : null,
		`Subject: ${encodeHeader(message.subject)}`,
		"MIME-Version: 1.0",
		message.html
			? 'Content-Type: multipart/alternative; boundary="hackkit-notification"'
			: 'Content-Type: text/plain; charset="UTF-8"',
	].filter(Boolean);
	if (!message.html) {
		return `${headers.join("\r\n")}\r\n\r\n${message.text}`;
	}
	return `${headers.join("\r\n")}\r\n\r\n--hackkit-notification\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${message.text}\r\n--hackkit-notification\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${message.html}\r\n--hackkit-notification--`;
}
class SmtpClient {
	private socket: Socket;
	private buffer = "";
	constructor(socket: Socket) {
		this.socket = socket;
		this.socket.setEncoding("utf8");
		this.socket.on("data", (chunk) => {
			this.buffer += chunk;
		});
	}
	static connect(
		options: SmtpEmailProviderOptions,
	): Effect.Effect<SmtpClient, BoundaryError> {
		return Effect.async<SmtpClient, BoundaryError>((resume) => {
			const port = options.port ?? (options.secure ? 465 : 587);
			const socket = options.secure
				? tls.connect({
						host: options.host,
						port,
						servername: options.host,
					})
				: net.connect({ host: options.host, port });
			const connected = () => {
				cleanup();
				resume(Effect.succeed(new SmtpClient(socket)));
			};
			const failed = (error: Error) => {
				cleanup();
				socket.destroy();
				resume(Effect.fail(boundaryError(error)));
			};
			const event = options.secure ? "secureConnect" : "connect";
			const cleanup = () => {
				socket.off("error", failed);
				socket.off(event, connected);
			};
			socket.once("error", failed);
			socket.once(event, connected);
			return Effect.sync(() => {
				cleanup();
				socket.destroy();
			});
		});
	}
	close(): Effect.Effect<void> {
		return Effect.sync(() => {
			this.socket.end();
		});
	}
	readResponse(): Effect.Effect<string, BoundaryError> {
		return Effect.async<string, BoundaryError>((resume) => {
			const onError = (error: Error) => {
				cleanup();
				resume(Effect.fail(boundaryError(error)));
			};
			const onClose = () =>
				onError(new Error("SMTP connection closed before a response."));
			const onData = () => {
				const lines = this.buffer.split(/\r?\n/).filter(Boolean);
				const last = lines.at(-1);
				if (!last || !/^\d{3} /.test(last)) return;
				const response = this.buffer;
				this.buffer = "";
				cleanup();
				resume(Effect.succeed(response));
			};
			const cleanup = () => {
				this.socket.off("error", onError);
				this.socket.off("data", onData);
				this.socket.off("close", onClose);
			};
			this.socket.on("error", onError);
			this.socket.on("data", onData);
			this.socket.once("close", onClose);
			onData();
			return Effect.sync(cleanup);
		});
	}
	command(
		command: string,
		expected: readonly number[],
	): Effect.Effect<string, BoundaryError> {
		return Effect.gen(this, function* () {
			this.socket.write(`${command}\r\n`);
			const response = yield* this.readResponse();
			const code = Number(response.slice(0, 3));
			if (!expected.includes(code))
				return yield* Effect.fail(
					boundaryError(
						new Error(`SMTP command failed: ${response.trim()}`),
					),
				);
			return response;
		});
	}
	upgradeToTls(host: string): Effect.Effect<SmtpClient, BoundaryError> {
		return Effect.async<SmtpClient, BoundaryError>((resume) => {
			const socket = tls.connect({
				socket: this.socket,
				servername: host,
			});
			const failed = (error: Error) => {
				cleanup();
				socket.destroy();
				resume(Effect.fail(boundaryError(error)));
			};
			const connected = () => {
				cleanup();
				this.socket = socket;
				socket.setEncoding("utf8");
				socket.on("data", (chunk) => {
					this.buffer += chunk;
				});
				resume(Effect.succeed(this));
			};
			const cleanup = () => {
				socket.off("error", failed);
				socket.off("secureConnect", connected);
			};
			socket.once("error", failed);
			socket.once("secureConnect", connected);
			return Effect.sync(() => {
				cleanup();
				socket.destroy();
			});
		});
	}
}
export function createSmtpEmailProvider(
	options: SmtpEmailProviderOptions,
): EmailProvider {
	return {
		id: "smtp",
		send(message) {
			return runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const client = yield* Effect.acquireRelease(
							SmtpClient.connect(options),
							(client) => client.close(),
						);
						yield* client.readResponse();
						const heloName = options.heloName ?? "hackkit.local";
						const ehlo = yield* client.command(`EHLO ${heloName}`, [
							250,
						]);
						if (!options.secure && ehlo.includes("STARTTLS")) {
							yield* client.command("STARTTLS", [220]);
							yield* client.upgradeToTls(options.host);
							yield* client.command(`EHLO ${heloName}`, [250]);
						}
						if (options.username && options.password) {
							yield* client.command("AUTH LOGIN", [334]);
							yield* client.command(
								encodeBase64(options.username),
								[334],
							);
							yield* client.command(
								encodeBase64(options.password),
								[235],
							);
						}
						yield* client.command(
							`MAIL FROM:<${normalizeAddress(message.from)}>`,
							[250],
						);
						yield* client.command(
							`RCPT TO:<${normalizeAddress(message.to)}>`,
							[250, 251],
						);
						yield* client.command("DATA", [354]);
						yield* client.command(
							`${buildSmtpMessage(message)}\r\n.`,
							[250],
						);
						yield* client.command("QUIT", [221]);
						return {
							metadata: {
								host: options.host,
								port: options.port,
							},
						};
					}),
				),
			);
		},
	};
}
