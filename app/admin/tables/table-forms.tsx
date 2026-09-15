"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addTable,
  deleteTable,
  renameTable,
  type FormState,
} from "@/app/admin/actions";
import type { RestaurantTable } from "@/lib/types";
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

export function AddTableForm() {
  const [state, action] = useActionState(addTable, EMPTY);

  return (
    <form
      action={action}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="mb-3 font-semibold text-slate-900">Add a table</h2>
      <div className="flex gap-2">
        <input
          name="label"
          placeholder="Table number"
          required
          className={`${field} max-w-48`}
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-slate-900 px-6 font-semibold text-white active:bg-slate-700"
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

/** Renaming and deleting, behind the row's Edit toggle. */
export function EditTablePanel({
  table,
  toggleId,
}: {
  table: RestaurantTable;
  /** The checkbox that opens this panel, so a successful save can close it. */
  toggleId: string;
}) {
  const [state, action] = useActionState(renameTable, EMPTY);
  const [deleteState, deleteAction] = useActionState(deleteTable, EMPTY);

  useCloseOnSave(toggleId, state);

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={table.id} />
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Number</span>
          <input
            name="label"
            defaultValue={table.label}
            required
            className={`${field} w-28`}
          />
        </label>
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
        <input type="hidden" name="id" value={table.id} />
        <input type="hidden" name="label" value={table.label} />
        <button
          type="submit"
          className="h-11 rounded-xl px-3 text-sm font-semibold text-red-600 active:bg-red-100"
        >
          <Saving>Delete</Saving>
        </button>
        <span className="text-xs text-slate-400">
          Only possible if it has never had an order.
        </span>
      </form>

      <Note state={deleteState} />
    </div>
  );
}
