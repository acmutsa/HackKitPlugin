import { notFound } from "next/navigation";
import { ScheduleDetail } from "@hackkit/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ScheduleEventPageProps = {
	params: {
		eventId: string;
	};
};

export default async function ScheduleEventPage({
	params,
}: ScheduleEventPageProps) {
	const [event, options] = await Promise.all([
		auth.api.getHackkitEvent({ body: { eventId: params.eventId } }),
		auth.api.getHackkitOptions(),
	]);

	if (!event) notFound();

	const eventType = options.eventTypes.find(
		(option) => option.value === event.type,
	);

	return (
		<ScheduleDetail
			event={event}
			typeLabel={eventType?.label ?? event.type}
			typeColor={eventType?.color ?? "#795548"}
			backHref="/schedule"
			actions={[
				{ label: "Open dashboard", href: "/dashboard" },
				{ label: "Get help", href: "/help" },
			]}
		/>
	);
}
