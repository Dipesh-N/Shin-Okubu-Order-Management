import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { HallView } from "./hall-view";

export const metadata = { title: "Hall · Okubu Momo" };

export default async function HallPage() {
  await requireRole("staff");

  return (
    <AppShell title="Hall" switchHref="/staff?pick=1" switchLabel="Switch view">
      <HallView />
    </AppShell>
  );
}
