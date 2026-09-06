// Design Ref: bare `/supplier` had no page.tsx, so Next.js fell through to the sibling
// `app/[locale]/page.tsx` dynamic route (treating "supplier" as an unrecognized locale value),
// which crashes in getDictionary() instead of 404ing — a 500 in production. Mirrors
// `app/admin/(protected)/page.tsx` existing purely to give this exact URL segment a page.
// Auth split (logged in -> profile, not -> login) is left to app/supplier/profile/layout.tsx's
// existing requireSupplierSession() check, same "middleware = session, protected layout =
// business rule" division of labor middleware.ts already documents.
import { redirect } from 'next/navigation'

export default function SupplierRootPage() {
  redirect('/supplier/profile')
}
