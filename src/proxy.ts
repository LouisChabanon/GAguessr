import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { publicSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the visitor's Supabase session once per request, before any Server Action or page reads it.
 * Without this, the server and the browser client each rotate the same refresh token, Supabase sees
 * it reused and revokes the session, and the visitor silently becomes a new anonymous player.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = publicSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Validates the token and rotates it when expired; the result itself is not needed here.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|json|mjs|pmtiles)$).*)"],
};
