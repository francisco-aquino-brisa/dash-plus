import { redirect } from "next/navigation";

// The admin area opens on Usuários. `/admin` just forwards there so the nav's
// active-state matching stays exact per screen.
export default function AdminIndex() {
  redirect("/admin/usuarios");
}
