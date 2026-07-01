import { Database } from "lucide-react";
import { MOCK_DATA_LABEL } from "@/lib/copy";

/** Warning pill flagging that the screen is rendered from the mock dataset. */
export function MockDataBadge() {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
      <Database className="h-3.5 w-3.5" /> {MOCK_DATA_LABEL}
    </span>
  );
}
