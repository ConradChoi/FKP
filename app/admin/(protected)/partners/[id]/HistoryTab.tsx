'use client'

// Design Ref: screen-spec §2.5.7 — audit_log where target_table='partner' and target_id=:id를
// 시간순 타임라인으로 렌더링. Gap G-4 고지 문구를 고정 표시한다.
import { AUDIT_ACTION_LABELS } from '@/lib/admin/partnerLabels'
import type { AuditLogEntry } from './page'

export function HistoryTab({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <section className="rounded-card border border-neutral-200 bg-neutral-0 p-5">
      <h2 className="admin-heading-3 text-neutral-900">변경이력</h2>
      <p className="mt-1 admin-label-sm text-neutral-400">
        Capability 항목(회사소개·서비스유형 등)의 직접 수정은 이 이력에 기록되지 않습니다.
      </p>

      <ul className="mt-4 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 border-b border-neutral-100 pb-2 last:border-0">
            <span className="w-40 shrink-0 admin-body-sm text-neutral-400">{new Date(entry.occurred_at).toLocaleString('ko-KR')}</span>
            <span className="flex-1 admin-body-sm text-neutral-800">
              {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
              {entry.result !== 'success' && <span className="ml-1 text-error">({entry.result})</span>}
            </span>
            <span className="w-32 shrink-0 admin-body-sm text-neutral-500">
              {entry.actor_kind === 'partner' ? '파트너' : entry.actor_kind === 'admin' ? '운영자' : '시스템'}
              {entry.actor_name_snapshot ? ` ${entry.actor_name_snapshot}` : ''}
            </span>
          </li>
        ))}
        {entries.length === 0 && <p className="admin-body-sm text-neutral-400">변경 이력이 없습니다.</p>}
      </ul>
    </section>
  )
}
