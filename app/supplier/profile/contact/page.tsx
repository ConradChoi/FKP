// Design Ref: screen-spec §4.5 (SUP-12) — "진입 시 rpc('get_own_partner_contact') 호출", done
// client-side by ContactForm itself (no partner_id needed, the RPC resolves the caller's own
// row) rather than a server fetch here.
import { ContactForm } from './ContactForm'

export default function SupplierContactPage() {
  return <ContactForm />
}
