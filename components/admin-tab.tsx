import "server-only";
import Link from "next/link";
import { IconShieldCheck } from "@/components/icons";
import { HIDDEN_ADMIN_PATH } from "@/lib/admin-gate";

export function AdminTab() {
  return (
    <Link href={HIDDEN_ADMIN_PATH} className="tab-admin">
      <IconShieldCheck small={false} />
      Admin
    </Link>
  );
}
