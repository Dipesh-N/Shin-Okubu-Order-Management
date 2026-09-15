"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addMenuItem,
  deleteMenuItem,
  updateMenuItem,
  type FormState,
} from "@/app/admin/actions";
import type { MenuItem } from "@/lib/types";
import { useCloseOnSave } from "@/lib/use-close-on-save";

const EMPTY: FormState = { error: null, ok: null };

const field =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-slate-900";

function Saving({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving…" : children}</>;
}

function Note({ state }: { state: FormState }) {
  if (state.error)
    return <p className="text-sm font-medium text-red-700">{state.error}</p>;
  if (state.ok)
    return <p className="text-sm font-medium text-green-700">{state.ok}</p>;
  return null;
}

export function AddMenuItemForm({ categories }: { categories: string[] }) {
  const [state, action] = useActionState(addMenuItem, EMPTY);
  const disabled = categories.length === 0;

  return (
    <form
      action={action}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="mb-3 font-semibold text-slate-900">Add an item</h2>

      {disabled && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Create a category first, under Categories above.
        </p>
      )}

      {/* Name takes the room; price and category only need a little. */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]">
        <input
          name="name"
          placeholder="Name"
          required
          disabled={disabled}
          className={field}
        />
        <input
          name="price"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="Price"
          required
          disabled={disabled}
          className={field}
        />
        <select
          name="category"
          required
          disabled={disabled}
          defaultValue=""
          className={field}
        >
          {/* Never pre-selected: choosing must be deliberate. */}
          <option value="" disabled>
            Category…
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={disabled}
          className="h-12 rounded-xl bg-slate-900 px-6 font-semibold text-white
                     active:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Saving>Add</Saving>
        </button>
      </div>

      <div className="mt-2 empty:mt-0">
        <Note state={state} />
      </div>
    </form>
  );
}

/**
 * Editing and deleting live behind the row's "Edit" disclosure: both are rare
 * next to marking something sold out, and deleting is irreversible.
 */
export function EditMenuItemPanel({
  item,
  categories,
  toggleId,
}: {
  item: MenuItem;
  categories: string[];
  /** The checkbox that opens this panel, so a successful save can close it. */
  toggleId: string;
}) {
  const [state, action] = useActionState(updateMenuItem, EMPTY);
  const [deleteState, deleteAction] = useActionState(deleteMenuItem, EMPTY);

  useCloseOnSave(toggleId, state);

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <form
        action={action}
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto]"
      >
        <input type="hidden" name="id" value={item.id} />
        <input name="name" defaultValue={item.name} required className={field} />
        <input
          name="price"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={item.price}
          required
          className={field}
        />
        <select name="category" defaultValue={item.category} required className={field}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-12 rounded-xl bg-slate-900 px-5 font-semibold text-white active:bg-slate-700"
        >
          <Saving>Save</Saving>
        </button>
      </form>

      <Note state={state} />

      <form
        action={deleteAction}
        className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="name" value={item.name} />
        <button
          type="submit"
          className="h-11 rounded-xl px-3 text-sm font-semibold text-red-600 active:bg-red-100"
        >
          <Saving>Delete</Saving>
        </button>
        <span className="text-xs text-slate-400">
          Only possible if it has never been ordered.
        </span>
      </form>

      <Note state={deleteState} />
    </div>
  );
}
