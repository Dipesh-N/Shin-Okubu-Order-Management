/**
 * Violet deliberately: red, orange and green already mean NEW, COOKING and
 * READY, so takeout needs a colour that cannot be mistaken for a status.
 */
export function TakeoutBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${className}`}
    >
      Takeout
    </span>
  );
}
