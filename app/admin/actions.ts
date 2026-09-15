"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string | null; ok: string | null };

const OK: FormState = { error: null, ok: null };

function parsePrice(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

// ---------------------------------------------------------------- menu items

export async function addMenuItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Food";
  const price = parsePrice(formData.get("price"));

  if (!name) return { ...OK, error: "Give the item a name." };
  if (price === null) return { ...OK, error: "Price must be a whole number of yen." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .insert({ name, price, category });

  if (error) return { ...OK, error: error.message };

  revalidatePath("/admin/menu");
  return { ...OK, ok: `Added ${name}.` };
}

export async function updateMenuItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || "Food";
  const price = parsePrice(formData.get("price"));

  if (!id) return { ...OK, error: "Missing item." };
  if (!name) return { ...OK, error: "Give the item a name." };
  if (price === null) return { ...OK, error: "Price must be a whole number of yen." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ name, price, category })
    .eq("id", id);

  if (error) return { ...OK, error: error.message };

  revalidatePath("/admin/menu");
  return { ...OK, ok: "Saved." };
}

/**
 * Sold out / back on. Menu items are never deleted, so history and past
 * receipts stay intact.
 */
export async function setMenuItemAvailable(formData: FormData): Promise<void> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const available = String(formData.get("available")) === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("menu_items").update({ is_available: available }).eq("id", id);

  revalidatePath("/admin/menu");
}

// -------------------------------------------------------------------- tables

export async function addTable(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { ...OK, error: "Give the table a number." };

  const supabase = await createClient();
  const { error } = await supabase.from("tables").insert({ label });

  if (error) {
    return {
      ...OK,
      error: error.code === "23505" ? `Table ${label} already exists.` : error.message,
    };
  }

  revalidatePath("/admin/tables");
  return { ...OK, ok: `Added table ${label}.` };
}

export async function renameTable(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !label) return { ...OK, error: "Give the table a number." };

  const supabase = await createClient();
  const { error } = await supabase.from("tables").update({ label }).eq("id", id);

  if (error) {
    return {
      ...OK,
      error: error.code === "23505" ? `Table ${label} already exists.` : error.message,
    };
  }

  revalidatePath("/admin/tables");
  return { ...OK, ok: "Saved." };
}

export async function setTableActive(formData: FormData): Promise<void> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active")) === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("tables").update({ is_active: active }).eq("id", id);

  revalidatePath("/admin/tables");
}

// ---------------------------------------------------------------- categories

export async function addCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ...OK, error: "Give the category a name." };

  const supabase = await createClient();

  // Put it at the end of the list.
  const { data: last } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("menu_categories")
    .insert({ name, sort_order: (last?.sort_order ?? 0) + 10 });

  if (error) {
    return {
      ...OK,
      error:
        error.code === "23505"
          ? `There is already a category called ${name}.`
          : error.message,
    };
  }

  revalidatePath("/admin/menu");
  return { ...OK, ok: `Added ${name}.` };
}

/**
 * Rename, reorder or remove one category.
 *
 * Renaming relies on ON UPDATE CASCADE in the database, so every item in the
 * category follows automatically — there is no loop over items here.
 */
export async function categoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const op = String(formData.get("op") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!name) return { ...OK, error: "Missing category." };

  const supabase = await createClient();

  if (op === "rename") {
    const next = String(formData.get("next") ?? "").trim();
    if (!next) return { ...OK, error: "Give the category a name." };
    if (next === name) return OK;

    const { error } = await supabase
      .from("menu_categories")
      .update({ name: next })
      .eq("name", name);

    if (error) {
      return {
        ...OK,
        error:
          error.code === "23505"
            ? `There is already a category called ${next}.`
            : error.message,
      };
    }
    revalidatePath("/admin/menu");
    return { ...OK, ok: "Renamed." };
  }

  if (op === "move") {
    const dir = String(formData.get("dir")) === "up" ? -1 : 1;

    const { data } = await supabase
      .from("menu_categories")
      .select("name, sort_order")
      .order("sort_order");

    const list = data ?? [];
    const i = list.findIndex((c) => c.name === name);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return OK; // already at the end

    // Swap the two positions.
    await supabase
      .from("menu_categories")
      .update({ sort_order: list[j].sort_order })
      .eq("name", list[i].name);
    await supabase
      .from("menu_categories")
      .update({ sort_order: list[i].sort_order })
      .eq("name", list[j].name);

    revalidatePath("/admin/menu");
    return OK;
  }

  if (op === "kitchen") {
    const needsKitchen = String(formData.get("needs_kitchen")) === "true";
    const { error } = await supabase
      .from("menu_categories")
      .update({ needs_kitchen: needsKitchen })
      .eq("name", name);

    if (error) return { ...OK, error: error.message };
    revalidatePath("/admin/menu");
    return OK;
  }

  if (op === "delete") {
    const { error } = await supabase
      .from("menu_categories")
      .delete()
      .eq("name", name);

    if (error) {
      // The foreign key refuses while items still point at it.
      return {
        ...OK,
        error:
          error.code === "23503"
            ? `${name} still has items in it. Move or rename them first.`
            : error.message,
      };
    }
    revalidatePath("/admin/menu");
    return { ...OK, ok: `Removed ${name}.` };
  }

  return { ...OK, error: "Unknown action." };
}

// ----------------------------------------------------------------- deletions

/**
 * Removing a mistake. The database refuses if the row has ever been used, so
 * this only needs to turn that refusal into a sentence worth reading.
 */
export async function deleteMenuItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "this item");
  if (!id) return { ...OK, error: "Missing item." };

  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);

  if (error) {
    return {
      ...OK,
      error:
        error.code === "23503"
          ? `${name} has been ordered before, so it cannot be deleted — past receipts still refer to it. Mark it sold out instead.`
          : error.message,
    };
  }

  revalidatePath("/admin/menu");
  return { ...OK, ok: `Deleted ${name}.` };
}

export async function deleteTable(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("admin");

  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "this table");
  if (!id) return { ...OK, error: "Missing table." };

  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", id);

  if (error) {
    return {
      ...OK,
      error:
        error.code === "23503"
          ? `Table ${label} has orders in its history, so it cannot be deleted. Disable it instead — it will disappear from Hall View.`
          : error.message,
    };
  }

  revalidatePath("/admin/tables");
  return { ...OK, ok: `Deleted table ${label}.` };
}
