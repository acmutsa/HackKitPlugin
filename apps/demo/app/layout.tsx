import type * as React from "react";
import type { Metadata } from "next";
import { PublicSiteFooter } from "@hackkit/ui";
import {
	getPublicThemeStyle,
	publicSiteConfig,
} from "@/lib/public-site-config";
import "./globals.css";
import { AppBar } from "./app-bar";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: publicSiteConfig.brand.name,
	description: publicSiteConfig.brand.description,
	robots: { index: false, follow: false },
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body style={getPublicThemeStyle()}>
				<Providers>
					<div className="border-b bg-primary px-6 py-2 text-center text-sm text-primary-foreground">
						Shared demo · Use fictional data only ·{" "}
						<a href="/" className="underline">
							Switch role
						</a>
					</div>
					<AppBar />
					{children}
					<PublicSiteFooter
						brandName={publicSiteConfig.brand.name}
						description={publicSiteConfig.brand.description}
						linkGroups={publicSiteConfig.footer.linkGroups}
						copyright={`${publicSiteConfig.event.name} · ${publicSiteConfig.event.dates} · ${publicSiteConfig.event.location}`}
					/>
				</Providers>
			</body>
		</html>
	);
}
