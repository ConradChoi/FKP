// The settings page was merged into 마이페이지 > 회원정보 변경. Kept as a redirect so existing
// links/bookmarks (and the marketing-withdrawal path named in the privacy policy) keep working.
import { redirect } from 'next/navigation'

export default function SeepnMySettingsPage() {
  redirect('/seepn/my/profile')
}
