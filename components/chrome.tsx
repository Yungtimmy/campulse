import Link from "next/link";
import { CategoryIcon, IconBack, IconClipboard, IconHome, IconPlus, IconPulse } from "@/components/icons";
import { BAND_LABEL, categoryTone, CONFIDENCE_LABEL, roomPill, STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import type { Band, ConfidenceLabel, PulseResult } from "@/lib/pulse";

const ARC = "M12.41 63.68 A40 40 0 1 1 87.59 63.68";

export function Blobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <i />
      <i />
    </div>
  );
}

export function SetupNotice() {
  return (
    <>
      <Blobs />
      <main className="app">
        <header className="top">
          <span className="room-pill">FUNAAB Room</span>
          <span className="wordmark">Campulse</span>
        </header>
        <section className="page-head">
          <h1>Campulse needs its environment</h1>
          <p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the app.</p>
        </section>
      </main>
    </>
  );
}

export function ForeignRoom({ home }: { home: string }) {
  return (
    <>
      <Blobs />
      <main className="app">
        <header className="top">
          <Link className="back" href={home}>
            <IconBack />
            Room
          </Link>
        </header>
        <section className="page-head">
          <h1>This Room is not yours</h1>
          <p>Reports stay inside the university you joined. There is no comparison between Rooms.</p>
        </section>
      </main>
    </>
  );
}

export function TabBar({ slug, active }: { slug: string; active: "room" | "report" | "pulse" }) {
  const base = `/room/${slug}`;
  return (
    <div className="tabbar">
      <nav aria-label="Room">
        <Link href={base} className={active === "room" ? "on" : undefined} aria-current={active === "room" ? "page" : undefined}>
          <IconHome />
          Room
        </Link>
        <Link href={`${base}/report/new`} className={active === "report" ? "on" : undefined} aria-current={active === "report" ? "page" : undefined}>
          <IconPlus />
          Report
        </Link>
        <Link href={`${base}/pulse`} className={active === "pulse" ? "on" : undefined} aria-current={active === "pulse" ? "page" : undefined}>
          <IconPulse />
          Pulse
        </Link>
      </nav>
    </div>
  );
}

export function RoomFrame({
  slug,
  name,
  active,
  back,
  children,
}: {
  slug: string;
  name?: string;
  active: "room" | "report" | "pulse";
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const pill = roomPill(slug, name);
  return (
    <>
      <Blobs />
      <main className="app">
        <header className="top">
          {back ? (
            <Link className="back" href={back.href}>
              <IconBack />
              {back.label}
            </Link>
          ) : (
            <span className="room-pill">{pill}</span>
          )}
          {back ? (
            <span className="room-pill sm">{pill}</span>
          ) : (
            <Link className="wordmark" href={`/room/${slug}`}>
              Campulse
            </Link>
          )}
        </header>
        {children}
      </main>
      <TabBar slug={slug} active={active} />
    </>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`status pill ${STATUS_CLASS[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function StatusText({ status }: { status: string }) {
  return <span className={`status ${STATUS_CLASS[status] ?? ""}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function DemoChip({ children = "Demo" }: { children?: string }) {
  return <span className="tag demo">{children}</span>;
}

export function ConfidenceTag({ label }: { label: ConfidenceLabel }) {
  return <span className={label === "calibrating" ? "tag pending" : "tag"}>{CONFIDENCE_LABEL[label]}</span>;
}

export function PulseGauge({
  result,
  stroke = 7,
}: {
  result: Pick<PulseResult, "score" | "conditions" | "band">;
  stroke?: number;
}) {
  const score = result.score;
  const total = score ?? 0;
  const conditions = Math.max(0, Math.min(total, result.conditions ?? 0));
  const band = result.band ? BAND_LABEL[result.band] : "Insufficient data";
  const label = score === null ? "Campus Pulse, insufficient data" : `Campus Pulse ${score} of 100, ${band}`;
  return (
    <div className="gauge">
      <svg viewBox="0 0 100 78" role="img" aria-label={label}>
        <path className="trk" d={ARC} pathLength={100} fill="none" strokeWidth={stroke} strokeLinecap="round" />
        {score !== null ? (
          <>
            <path className="resp" d={ARC} pathLength={100} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${total} 200`} />
            <path className="cond" d={ARC} pathLength={100} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${conditions} 200`} />
          </>
        ) : null}
      </svg>
    </div>
  );
}

export function BandName({ band }: { band: Band | null }) {
  if (!band) return null;
  return <span className={`band ${band}`}>{BAND_LABEL[band]}</span>;
}

export function CategoryAvatar({ category }: { category: string }) {
  return (
    <span className={`av ${categoryTone(category)}`}>
      <CategoryIcon category={category} />
    </span>
  );
}

export function MyReportsButton({ href }: { href: string }) {
  return (
    <Link className="icon-btn" href={href} aria-label="My reports" title="My reports">
      <IconClipboard />
    </Link>
  );
}
