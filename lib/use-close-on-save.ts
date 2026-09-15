"use client";

import { useEffect } from "react";
import type { FormState } from "@/app/admin/actions";

/**
 * Collapses an edit panel once its save succeeds.
 *
 * The panel is opened by a hidden checkbox and CSS, so a server action can
 * re-render the row without the panel noticing — it stays open, looking like
 * nothing happened. Unchecking the box closes it.
 *
 * Depends on the whole `state` object rather than `state.ok`: useActionState
 * hands back a fresh object on every submit, so a second save with the same
 * "Saved." message still re-runs this. Keying on the string would close the
 * panel the first time and never again.
 */
export function useCloseOnSave(toggleId: string, state: FormState) {
  useEffect(() => {
    if (!state.ok) return;
    const toggle = document.getElementById(toggleId);
    if (toggle instanceof HTMLInputElement) toggle.checked = false;
  }, [state, toggleId]);
}
