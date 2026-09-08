/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workaround for a confirmed AWS Amplify Hosting bug on this app (see git log 0e7410b,
  // 2026-08-27; re-confirmed 2026-09-04 via a live diagnostic endpoint after checking off
  // every console-side possibility — single app, "all branches" scope, WEB_COMPUTE/SSR
  // platform, correct value all verified): environment variables configured in the Amplify
  // console reliably reach `process.env` during the BUILD phase, but never reach the deployed
  // SSR compute's runtime `process.env` unless they're prefixed `NEXT_PUBLIC_` (which Next.js
  // inlines at build time regardless of runtime propagation — the same mechanism this `env`
  // block uses explicitly for non-public names).
  //
  // Listing a var here makes Next.js statically replace every `process.env.<NAME>` reference
  // in the compiled output with its build-time value — the same "bake it in at build time"
  // path NEXT_PUBLIC_ vars already ride, just without exposing it to client bundles, since
  // Next.js only ships code into the browser that's actually imported from a 'use client'
  // boundary. Every var listed here (adminClient.ts, the purge-worker route) is exclusively
  // used in Route Handlers/Server Components, never imported by client components.
  //
  // Do NOT add a var here if it's ever imported from client-side code — that would bake a
  // secret straight into the public browser bundle.
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PARTNER_DOC_PURGE_CRON_SECRET: process.env.PARTNER_DOC_PURGE_CRON_SECRET,
    // lib/server/googleTranslate.ts — Admin "AI 초벌 채우기" (admin-ai-translation-draft.
    // screen-spec.md §6.3). Only ever imported from Server Actions, never a 'use client' file
    // — see that module's header for why. Same Amplify SSR env-var propagation bug as the two
    // vars above (project memory: amplify_env_var_bug.md) is why these must be listed here too.
    GOOGLE_TRANSLATE_PROJECT_ID: process.env.GOOGLE_TRANSLATE_PROJECT_ID,
    GOOGLE_TRANSLATE_CREDENTIALS_JSON: process.env.GOOGLE_TRANSLATE_CREDENTIALS_JSON,
    GOOGLE_TRANSLATE_LOCATION: process.env.GOOGLE_TRANSLATE_LOCATION,
    GOOGLE_TRANSLATE_TIMEOUT_MS: process.env.GOOGLE_TRANSLATE_TIMEOUT_MS,
  },
}

module.exports = nextConfig
