import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role;
};

/**
 * Data Access Layer.
 *
 * Every protected page and Server Action calls one of these. proxy.ts only
 * does a cheap optimistic redirect; this is where access is actually decided
 * on the server, backed by Row Level Security in the database.
 *
 * Wrapped in React `cache` so several components in one render share a single
 * lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  // getClaims() verifies the JWT rather than trusting the cookie contents.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return null;

  const userId = claimsData.claims.sub;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  // Signed in but no profile row: treat as unauthenticated rather than
  // guessing a role.
  if (error || !profile) return null;

  return {
    id: profile.id,
    email: (claimsData.claims.email as string | undefined) ?? null,
    fullName: profile.full_name,
    role: profile.role as Role,
  };
});

/** Requires any signed-in user. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires a specific role. Sends the wrong role to where it belongs. */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === "admin" ? "/admin" : "/staff");
  return user;
}

/** Where a user lands after logging in. */
export function homeForRole(role: Role): string {
  return role === "admin" ? "/admin" : "/staff";
}
