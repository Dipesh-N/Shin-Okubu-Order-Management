"use client";

/**
 * Going back is the most-used control in Hall View, and it used to be a plain
 * text link with no visible edges — easy to miss with a thumb on a moving
 * tablet. One component so every screen's back button is the same size and
 * in the same place.
 */
export function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl bg-slate-100 px-4
                 font-semibold text-slate-700 ring-1 ring-slate-300
                 active:bg-slate-200"
    >
      <span aria-hidden className="text-lg leading-none">
        &larr;
      </span>
      {label}
    </button>
  );
}
