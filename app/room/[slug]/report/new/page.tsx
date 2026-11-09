import { RoomFrame } from "@/components/chrome";
import { requireRoom } from "@/lib/guard";
import { ReportForm } from "./report-form";

export default async function NewReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await requireRoom(slug);
  if (!room.ok) return room.view;
  return (
    <RoomFrame slug={slug} name={room.uni.name} active="report" showAdmin={room.showAdmin} back={{ href: `/room/${slug}`, label: "Room" }}>
      <section className="page-head">
        <h1>Report an issue</h1>
        <p>Describe what&apos;s wrong and where. Admins in the {roomPillName(room.uni.slug)} review every report.</p>
      </section>
      <ReportForm slug={slug} />
    </RoomFrame>
  );
}

function roomPillName(slug: string): string {
  return slug === "funaab" ? "FUNAAB Room" : "Room";
}
