"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/tables", label: "Tables" },
  { href: "/admin/sales", label: "Sales" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-3xl gap-2 overflow-x-auto px-3 py-2 sm:px-4">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
