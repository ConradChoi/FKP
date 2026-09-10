// Design Ref: app/supplier/page.tsx precedent (bare /supplier 500'd in prod until this kind of
// redirect page was added) — bare /seepn should land on the list (BY-08), the one screen that
// needs no login (screen-spec §2.1 step 1).
import { redirect } from 'next/navigation'

export default function SeepnRootPage() {
  redirect('/seepn/partners')
}
