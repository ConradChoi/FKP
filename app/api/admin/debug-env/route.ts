// TEMPORARY diagnostic route — 2026-08-27. Admin login on production returns CONFIG_ERROR
// (getSupabaseAuthServerClient() sees NEXT_PUBLIC_SUPABASE_URL/SUPABASE_ANON_KEY as falsy)
// even after confirming the vars exist in the Amplify console (correct name, value, "모든
// 브랜치" scope) and forcing a fresh git-triggered rebuild. This endpoint reports ONLY
// boolean presence (never the actual value) so we can tell, from the running Lambda's own
// process.env, whether these three vars are actually reaching the SSR runtime — narrows
// down "Amplify console says it's set" vs "the running server process actually sees it".
// DELETE this file once the root cause is confirmed and fixed.
export async function GET() {
  return Response.json({
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    nodeEnv: process.env.NODE_ENV ?? null,
  })
}
