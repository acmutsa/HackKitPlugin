import type { CSSProperties } from "react";
import type {
	PublicLandingPageProps,
	PublicShellLink,
	PublicSiteFooterGroup,
} from "@hackkit/ui";

export type PublicSiteConfig = {
	brand: {
		name: string;
		shortName: string;
		description: string;
	};
	event: {
		name: string;
		dates: string;
		location: string;
		timezone: string;
	};
	theme: {
		primary: string;
		ring: string;
	};
	nav: {
		public: PublicShellLink[];
		participant: PublicShellLink[];
	};
	landing: Omit<
		PublicLandingPageProps,
		"primaryAction" | "secondaryAction"
	> & {
		primaryAction: PublicShellLink;
		secondaryAction: PublicShellLink;
		signedInAction: PublicShellLink;
	};
	help: {
		title: string;
		description: string;
		contacts: PublicShellLink[];
		resources: PublicShellLink[];
	};
	dashboard: {
		primaryActions: PublicShellLink[];
		resourceLinks: PublicShellLink[];
	};
	footer: {
		linkGroups: PublicSiteFooterGroup[];
	};
};

export const publicSiteConfig = {
	brand: {
		name: "HackKit",
		shortName: "HackKit",
		description: "Hackathon registration and participant management.",
	},
	event: {
		name: "Your hackathon",
		dates: "Dates to be announced",
		location: "Location to be announced",
		timezone: "America/Chicago",
	},
	theme: { primary: "221.2 83.2% 53.3%", ring: "221.2 83.2% 53.3%" },
	nav: {
		public: [{ label: "Help", href: "/help" }],
		participant: [
			{ label: "Dashboard", href: "/dashboard" },
			{ label: "Settings", href: "/settings" },
		],
	},
	landing: {
		eyebrow: "HackKit",
		title: "Register for your next hackathon.",
		description:
			"Create an account, complete registration, and manage your participant profile.",
		primaryAction: { label: "Apply now", href: "/sign-up" },
		secondaryAction: { label: "Get help", href: "/help" },
		signedInAction: { label: "Open dashboard", href: "/dashboard" },
		highlights: [],
		sections: [],
		stats: [],
	},
	help: {
		title: "Contact and help",
		description: "Contact the organizing team for registration help.",
		contacts: [
			{
				label: "Organizer support",
				href: "mailto:organizers@example.com",
			},
		],
		resources: [
			{ label: "Dashboard", href: "/dashboard" },
			{ label: "Registration", href: "/settings/registration" },
		],
	},
	dashboard: {
		primaryActions: [
			{ label: "Edit registration", href: "/settings/registration" },
			{ label: "Profile settings", href: "/settings" },
		],
		resourceLinks: [{ label: "Help", href: "/help" }],
	},
	footer: {
		linkGroups: [
			{
				title: "HackKit",
				links: [
					{ label: "Help", href: "/help" },
					{ label: "Apply", href: "/sign-up" },
					{ label: "Dashboard", href: "/dashboard" },
				],
			},
		],
	},
} satisfies PublicSiteConfig;
export function getPublicThemeStyle(): CSSProperties {
	return {
		"--primary": publicSiteConfig.theme.primary,
		"--ring": publicSiteConfig.theme.ring,
	} as CSSProperties;
}
