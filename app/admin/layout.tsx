import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { RESTAURANT_NAME } from "@/lib/restaurant";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("admin");

  return (
    <AppShell title={`${RESTAURANT_NAME} · Admin`}>
      <AdminNav />
      {/* Admin screens are forms and lists, not dashboards. Past ~700px they
          just stretch into a gap between the label and its buttons. */}
      <div className="mx-auto w-full max-w-3xl flex-1 p-3 sm:p-4">
        {children}
      </div>
    </AppShell>
  );
}
