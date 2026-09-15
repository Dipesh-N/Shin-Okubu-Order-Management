import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Next.js 16 renamed middleware to Proxy. Runs before every matched request.
 *
 * Two jobs:
 *   1. Refresh the Supabase session cookie so it never silently expires on a
 *      tablet that has been open all day.
 *   2. An optimistic redirect for signed-out visitors.
 *
 * This is NOT the security boundary — it only reads a cookie. Real enforcement
 * lives in lib/auth.ts and in Row Level Security.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN,
        // or one user's token could be served to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must run before the response is generated, so a refreshed token can still
  // be written to cookies.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!isSignedIn && !isLogin) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isSignedIn && isLogin) {
    // Role decides the destination; "/" resolves it.
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation, which never
     * need a session.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
