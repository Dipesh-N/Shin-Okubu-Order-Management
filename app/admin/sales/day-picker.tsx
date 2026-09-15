"use client";

import { useRouter } from "next/navigation";

/** Picking a date navigates straight away — no extra "Go" tap on a tablet. */
export function DayPicker({ date, max }: { date: string; max: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      name="date"
      defaultValue={date}
      max={max}
      aria-label="Show sales for"
      onChange={(e) => {
        const value = e.target.value;
        if (value) router.push(`/admin/sales?date=${value}`);
      }}
      className="h-12 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-slate-900"
    />
  );
}
