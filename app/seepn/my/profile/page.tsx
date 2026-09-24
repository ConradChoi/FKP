import { MyComingSoon } from '@/components/seepn/MyComingSoon'

export default function SeepnMyProfilePage() {
  return (
    <MyComingSoon
      title="회원정보 변경"
      description="이름 등 회원정보를 수정하는 기능이 곧 제공됩니다."
      action={{ href: '/seepn/my/settings', label: '마케팅 수신 동의 설정 →' }}
    />
  )
}
