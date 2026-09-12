// Design Ref: docs/02-design/features/seepn-partner-web-p6-dashboard.screen-spec.md §0.4/§1.2
// (D-D2, OQ-D3 대표 확정 2026-09-12) — this index route's redirect target moved from
// /supplier/profile/basic to /supplier/profile/dashboard. The old comment here cited
// partner-supplier-app.screen-spec.md §0.1 D-S3 ("전용 대시보드(SS-14)는 만들지 않는다, 로그인 후
// 랜딩은 /supplier/profile이며 상태 배너만으로 검증 진행 상황을 알린다") — that decision was made
// while PRD SS-14 was a Won't. PRD rev7 reopened SS-14 (narrowed to a bookmark/inquiry-count
// dashboard tab) and D-D2 supersedes D-S3 within that scope. D-S3's underlying principle (status
// banner communicates verification progress) is unchanged — SupplierProfileShell's banner still
// renders above every tab, including the new dashboard tab; only the default tab under it moved.
import { redirect } from 'next/navigation'

export default function SupplierProfileIndexPage() {
  redirect('/supplier/profile/dashboard')
}
