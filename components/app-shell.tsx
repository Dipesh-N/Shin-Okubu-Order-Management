import Link from "next/link";
import { signOut } from "@/app/login/actions";

type Props = {
  title: string;
  /** Optional link shown next to the title, e.g. back to the mode picker. */
  switchHref?: string;
  switchLabel?: string;
  children: React.ReactNode;
};

/**
 * The frame every signed-in screen sits in: a thin dark bar and the content.
 * Deliberately not a sidebar dashboard — staff need the whole screen.
 */
export function AppShell({ title, switchHref, switchLabel, children }: Props) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-4 bg-slate-900 px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">{title}</h1>

        {switchHref && (
          <Link
            href={switchHref}
            className="flex h-10 items-center rounded-xl bg-white/15 px-4 text-sm font-semibold active:bg-white/25"
          >
            {switchLabel ?? "Switch"}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-2">
          <form action={signOut}>
            <button
              type="submit"
              className="flex h-10 items-center rounded-xl bg-white/15 px-4 text-sm font-semibold active:bg-white/25"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
