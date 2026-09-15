"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff/kitchen", label: "Tickets" },
  { href: "/staff/kitchen/totals", label: "To cook" },
] as const;

/** Two big targets — the kitchen switches between these with wet hands. */
export function KitchenTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 border-b border-slate-200 bg-white px-3 py-2">
      {TABS.map((tab) => {
        // "/staff/kitchen" would otherwise match the totals page too.
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl text-base font-bold ${
              active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
