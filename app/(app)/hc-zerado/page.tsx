import { redirect } from "next/navigation";

// The module opens on Desempenho HC. `/hc-zerado` just forwards there so the
// nav's active-state matching stays exact per screen.
export default function HcZeradoIndex() {
  redirect("/hc-zerado/desempenho");
}
