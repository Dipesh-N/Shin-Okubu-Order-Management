"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addCategory, categoryAction, type FormState } from "@/app/admin/actions";
import type { MenuCategory } from "@/lib/types";

const EMPTY: FormState = { error: null, ok: null };
const inputClass =
  "h-12 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-slate-900";

function Saving({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : children}</>;
}

function AddCategoryForm() {
  const [state, action] = useActionState(addCategory, EMPTY);

  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input
        name="name"
        placeholder="New category name"
        required
        className={`${inputClass} min-w-40 flex-1`}
      />
      <button
        type="submit"
        className="h-12 rounded-xl bg-slate-900 px-6 font-semibold text-white active:bg-slate-700"
      >
        <Saving>Add category</Saving>
      </button>
      {state.error && (
        <p className="w-full text-sm font-medium text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="w-full text-sm font-medium text-green-700">{state.ok}</p>
      )}
    </form>
  );
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  itemCount,
}: {
  category: MenuCategory;
  isFirst: boolean;
  isLast: boolean;
  itemCount: number;
}) {
  const [state, action] = useActionState(categoryAction, EMPTY);

  return (
    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        {/* Order controls sit together on the left, where the eye starts. */}
        <form action={action} className="flex shrink-0 gap-1">
          <input type="hidden" name="name" value={category.name} />
          <input type="hidden" name="op" value="move" />
          <button
            type="submit"
            name="dir"
            value="up"
            disabled={isFirst}
            aria-label={`Move ${category.name} up`}
            className="h-11 w-11 rounded-xl bg-white font-bold ring-1 ring-slate-200
                       active:bg-slate-100 disabled:opacity-30"
          >
            &uarr;
          </button>
          <button
            type="submit"
            name="dir"
            value="down"
            disabled={isLast}
            aria-label={`Move ${category.name} down`}
            className="h-11 w-11 rounded-xl bg-white font-bold ring-1 ring-slate-200
                       active:bg-slate-100 disabled:opacity-30"
          >
            &darr;
          </button>
        </form>

        <form action={action} className="flex min-w-0 flex-1 gap-2">
          <input type="hidden" name="name" value={category.name} />
          <input type="hidden" name="op" value="rename" />
          <input
            name="next"
            defaultValue={category.name}
            required
            aria-label={`Rename ${category.name}`}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-xl bg-slate-200 px-4 font-semibold text-slate-800 active:bg-slate-300"
          >
            <Saving>Rename</Saving>
          </button>
        </form>

        <span className="w-16 shrink-0 text-right text-sm text-slate-500">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>

        {/* Drinks are poured by the waiter; only cooked categories should
            reach the kitchen screen. */}
        <form action={action} className="shrink-0">
          <input type="hidden" name="name" value={category.name} />
          <input type="hidden" name="op" value="kitchen" />
          <input
            type="hidden"
            name="needs_kitchen"
            value={String(!category.needs_kitchen)}
          />
          <button
            type="submit"
            title={
              category.needs_kitchen
                ? `${category.name} is sent to the kitchen — tap to stop sending it`
                : `${category.name} is not sent to the kitchen — tap to start sending it`
            }
            className={`h-11 whitespace-nowrap rounded-xl px-3 text-sm font-semibold ${
              category.needs_kitchen
                ? "bg-orange-100 text-orange-900 active:bg-orange-200"
                : "bg-slate-200 text-slate-600 active:bg-slate-300"
            }`}
          >
            {category.needs_kitchen ? "To kitchen" : "No kitchen"}
          </button>
        </form>

        {/* Always visible, but disabled while it still holds items — a
            missing button just reads as broken. */}
        <form action={action} className="shrink-0">
          <input type="hidden" name="name" value={category.name} />
          <input type="hidden" name="op" value="delete" />
          <button
            type="submit"
            disabled={itemCount > 0}
            title={
              itemCount > 0
                ? "Move or delete its items first"
                : `Remove ${category.name}`
            }
            className="h-11 rounded-xl px-3 text-sm font-semibold text-red-600
                       active:bg-red-50 disabled:text-slate-300"
          >
            <Saving>Remove</Saving>
          </button>
        </form>
      </div>

      {state.error && (
        <p className="mt-1 text-sm font-medium text-red-700">{state.error}</p>
      )}
    </div>
  );
}

export function CategoryManager({
  categories,
  counts,
}: {
  categories: MenuCategory[];
  counts: Record<string, number>;
}) {
  return (
    <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer font-semibold text-slate-900">
        Categories
        <span className="ml-2 font-normal text-slate-500">
          ({categories.length}) — add, rename, reorder
        </span>
      </summary>

      <p className="mt-2 text-sm text-slate-500">
        The order here is the order waiters see the tabs in. A category can
        only be removed once it is empty. Turn off &ldquo;To kitchen&rdquo; for
        things the waiter serves directly, like drinks &mdash; those never
        appear on the kitchen screen.
      </p>

      <div className="mt-3 space-y-2">
        {categories.map((c, i) => (
          <CategoryRow
            key={c.name}
            category={c}
            isFirst={i === 0}
            isLast={i === categories.length - 1}
            itemCount={counts[c.name] ?? 0}
          />
        ))}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <AddCategoryForm />
      </div>
    </details>
  );
}
