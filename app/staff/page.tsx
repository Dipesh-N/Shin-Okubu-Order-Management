import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ModePicker } from "./mode-picker";

export const metadata = { title: "Choose view · Okubu Momo" };

export default async function StaffModePage() {
  await requireRole("staff");

  return (
    <AppShell title="Okubu Momo">
      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <ModePicker />
      </Suspense>
    </AppShell>
  );
}
