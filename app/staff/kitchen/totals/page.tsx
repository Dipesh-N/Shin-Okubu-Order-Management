import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KitchenTabs } from "../kitchen-tabs";
import { KitchenTotalsView } from "./totals-view";

export const metadata = { title: "To cook · Okubu Momo" };

export default async function KitchenTotalsPage() {
  await requireRole("staff");

  return (
    <AppShell title="Kitchen" switchHref="/staff?pick=1" switchLabel="Switch view">
      <KitchenTabs />
      <KitchenTotalsView />
    </AppShell>
  );
}
