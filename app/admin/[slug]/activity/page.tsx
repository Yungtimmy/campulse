import { requireAdmin } from "@/lib/guard";
import { formatWhen } from "@/lib/labels";

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  meta: Record<string, unknown> | null;
  actor_id: string | null;
};

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await requireAdmin(slug);
  if (!admin.ok) return admin.view;
  const { data } = await admin.supabase
    .from("admin_audit")
    .select("id, action, created_at, meta, actor_id")
    .eq("university_id", admin.uni.id)
    .order("created_at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as AuditRow[];

  return (
    <main className="main">
      <div className="mhead">
        <div>
          <h1>Activity log</h1>
          <p>Status changes, assignments, rejections, verification decisions, and identity access.</p>
        </div>
      </div>
      <section className="card" style={{ marginTop: 20 }}>
        {rows.length === 0 ? <p className="hint">No admin actions yet.</p> : null}
        <ul className="audit">
          {rows.map((row) => (
            <li key={row.id}>
              <time>{formatWhen(row.created_at)}</time>
              <span>
                <b>{label(row.action)}</b>
                {detail(row.meta)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function label(action: string): string {
  return action.replaceAll("_", " ");
}

function detail(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  if (typeof meta.from === "string" && typeof meta.to === "string") return ` · ${meta.from} → ${meta.to}`;
  if (typeof meta.department === "string") return ` · ${meta.department}`;
  if (typeof meta.status === "string") return ` · ${meta.status}`;
  return "";
}
