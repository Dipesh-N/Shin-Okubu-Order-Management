/**
 * Reads the two public Supabase settings.
 *
 * Both are safe to expose to the browser: the publishable key only grants what
 * Row Level Security allows. The secret / service_role key is deliberately not
 * used anywhere in this app.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Supabase replaced the legacy "anon" JWT with publishable keys. Accept
  // either so the app works on both new and older projects.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local, fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, " +
        "then restart `npm run dev`.",
    );
  }
  return { url, key };
}
