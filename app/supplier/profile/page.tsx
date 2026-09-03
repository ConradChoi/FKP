// Design Ref: screen-spec D-S3 — "전용 대시보드(SS-14)는 만들지 않는다. 로그인 후 랜딩은
// /supplier/profile이며, 화면 상단 '상태 배너'만으로 검증 진행 상황을 알린다." The shell
// (layout.tsx) already renders the banner/tabs/checklist for every /supplier/profile/* route;
// this bare index route just needs a default tab to land on.
import { redirect } from 'next/navigation'

export default function SupplierProfileIndexPage() {
  redirect('/supplier/profile/basic')
}
