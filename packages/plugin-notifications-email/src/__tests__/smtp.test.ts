import net from "node:net";
import { once } from "node:events";
import { expect, it } from "vitest";
import { createSmtpEmailProvider } from "../providers";

it.each([false, true])(
	"releases the SMTP connection after delivery, reject=%s",
	async (reject) => {
		let closed = false;
		let resolveClosed: () => void = () => {};
		const connectionClosed = new Promise<void>((resolve) => {
			resolveClosed = resolve;
		});
		const server = net.createServer((socket) => {
			socket.setEncoding("utf8");
			socket.on("close", () => {
				closed = true;
				resolveClosed();
			});
			socket.write("220 local SMTP ready\r\n");
			let buffer = "";
			let data = false;
			socket.on("data", (chunk) => {
				buffer += chunk;
				while (buffer.includes("\r\n")) {
					const end = buffer.indexOf("\r\n");
					const line = buffer.slice(0, end);
					buffer = buffer.slice(end + 2);
					if (data && line !== ".") continue;
					if (line === ".") {
						data = false;
						socket.write("250 queued\r\n");
					} else if (line.startsWith("EHLO"))
						socket.write("250 local\r\n");
					else if (line.startsWith("MAIL FROM"))
						socket.write(
							reject
								? "550 rejected\r\n"
								: "250 sender accepted\r\n",
						);
					else if (line.startsWith("RCPT TO"))
						socket.write("250 recipient accepted\r\n");
					else if (line === "DATA") {
						data = true;
						socket.write("354 send message\r\n");
					} else if (line === "QUIT") socket.write("221 goodbye\r\n");
				}
			});
		});
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		if (!address || typeof address === "string")
			throw new Error("Missing SMTP test address");
		try {
			const delivery = createSmtpEmailProvider({
				host: "127.0.0.1",
				port: address.port,
			}).send({
				from: "from@example.com",
				to: "to@example.com",
				subject: "Test",
				text: "Scoped SMTP delivery",
			});
			if (reject) await expect(delivery).rejects.toThrow("550 rejected");
			else
				await expect(delivery).resolves.toMatchObject({
					metadata: { host: "127.0.0.1", port: address.port },
				});
			await connectionClosed;
			expect(closed).toBe(true);
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	},
);
