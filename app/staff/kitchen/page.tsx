import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { KitchenTabs } from "./kitchen-tabs";
import { KitchenView } from "./kitchen-view";

export const metadata = { title: "Kitchen · Okubu Momo" };

export default async function KitchenPage() {
  await requireRole("staff");

  return (
    <AppShell title="Kitchen" switchHref="/staff?pick=1" switchLabel="Switch view">
      <KitchenTabs />
      <KitchenView />
    </AppShell>
  );
}
