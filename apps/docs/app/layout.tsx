import { Provider } from "@/components/provider";
import "./global.css";

export const metadata = {
	title: { default: "HackKit documentation", template: "%s | HackKit" },
	description:
		"Build and operate a hackathon with HackKit. Runnable templates, authentication, registration, plugins, and event operations.",
};

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<Provider>{children}</Provider>
			</body>
		</html>
	);
}
