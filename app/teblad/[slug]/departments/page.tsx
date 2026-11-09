import { DEPARTMENTS } from "@/lib/labels";
import { requireAdmin } from "@/lib/guard";

export default async function DepartmentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await requireAdmin(slug);
  const { data } = await admin.supabase
    .from("incidents")
    .select("assigned_department, status")
    .eq("university_id", admin.uni.id);
  const rows = (data ?? []) as Array<{ assigned_department: string | null; status: string }>;

  return (
    <main className="main">
      <div className="mhead">
        <div>
          <h1>Departments</h1>
          <p>Assignment is a note on the incident, not a status. Department list is demo data.</p>
        </div>
        <span className="tag demo">Demo data</span>
      </div>
      <div className="stats" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {DEPARTMENTS.map((name) => {
          const assigned = rows.filter((row) => row.assigned_department === name);
          const open = assigned.filter((row) => row.status !== "resolved" && row.status !== "rejected").length;
          return (
            <div className="stat" key={name}>
              <div className="k">{name}</div>
              <div className="v">{open}</div>
              <div className="d">{assigned.length} assigned in total</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
