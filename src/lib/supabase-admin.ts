import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for SERVER-SIDE use only (API routes).
 *
 * The browser client (`@/lib/supabase`) uses the publishable/anon key,
 * which is subject to RLS. The `orders` table's RLS only exposes a row
 * to its owning user (`auth.uid() = user_id`); an admin API route has no
 * logged-in Supabase user, so the anon client sees ZERO orders. The
 * service-role key bypasses RLS so the admin can read/manage all orders.
 *
 * NEVER import this into a client component — the service-role key has
 * full bypass-RLS privileges and must stay on the server.
 *
 * Returns null when the key isn't configured so callers can handle it.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
