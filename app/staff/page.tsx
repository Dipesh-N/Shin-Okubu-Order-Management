import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { RESTAURANT_NAME } from "@/lib/restaurant";
import { ModePicker } from "./mode-picker";

export const metadata = { title: "Choose view" };

export default async function StaffModePage() {
  await requireRole("staff");

  return (
    <AppShell title={RESTAURANT_NAME}>
      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <ModePicker />
      </Suspense>
    </AppShell>
  );
}
