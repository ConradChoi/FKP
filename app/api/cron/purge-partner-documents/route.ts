// Design Ref: docs/03-security/partner-supplier-app-ui-privacy-review.md §5.1
// (UI-B5) + docs/03-security/partner-supplier-app-ceo-decisions.md §1 — "첫
// 티켓" per the ceo memo, gate moved up to "P1 프로덕션 배포 전" (not "가입 오픈
// 전"). SQL cannot call the Storage REST API (documented gap at
// private.mark_expired_partner_documents_for_purge, 20260829140000 lines
// ~1882-1887) — this route is that out-of-band consumer.
//
// Trigger mechanism: this project deploys to AWS Amplify Hosting, which has no
// built-in scheduled-invocation feature equivalent to Vercel Cron. Rather than
// stand up new AWS infrastructure (EventBridge Scheduler + IAM) for a
// 30-50-partner v1.0, this route is designed to be called over plain HTTP by
// an external scheduler carrying a shared secret — see
// .github/workflows/purge-partner-documents.yml (GitHub Actions scheduled
// workflow, every 15 minutes) for the trigger this repo actually ships. Any
// other external scheduler (cron-job.org, AWS EventBridge Scheduler, etc.)
// can call this same endpoint the same way if the trigger mechanism changes
// later — the route itself does not care who calls it, only that they know
// PARTNER_DOC_PURGE_CRON_SECRET.
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

const BATCH_LIMIT = 200

function isAuthorized(request: Request): boolean {
  // .trim() on both sides: console/CLI text fields for this value have repeatedly picked up
  // invisible leading/trailing whitespace or a trailing newline from copy-paste in practice,
  // which silently breaks the exact-string comparison below without any visible sign why.
  const secret = process.env.PARTNER_DOC_PURGE_CRON_SECRET?.trim()
  if (!secret) return false // fail closed if the secret was never configured
  const header = request.headers.get('authorization')?.trim() ?? ''
  return header === `Bearer ${secret}`
}

type PendingDocument = { document_id: string; partner_id: string; storage_path: string }

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const adminClient = getSupabaseAdminClient()
  if (!adminClient) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })

  // Step 1: pull the queue (feeds from partner_withdraw's immediate queuing,
  // mark_expired_partner_documents_for_purge's verified+90d batch, and
  // purge_rejected_partner_pii's rejected+90d batch — all three write to the
  // same pending_deletion_at column, so there is only one queue to drain).
  const { data: pending, error: selectError } = await adminClient.rpc('select_pending_deletion_documents', {
    p_limit: BATCH_LIMIT,
  })
  if (selectError) {
    console.error(`purge-partner-documents: select_pending_deletion_documents failed: ${selectError.message}`)
    return NextResponse.json({ error: 'select_failed' }, { status: 500 })
  }

  const rows = (pending ?? []) as PendingDocument[]
  let deletedCount = 0
  let failedCount = 0
  const failedPaths: string[] = []

  for (const row of rows) {
    // Step 2a: remove the Storage object FIRST.
    const { error: removeError } = await adminClient.storage.from('partner-doc').remove([row.storage_path])
    if (removeError) {
      // Supabase Storage's remove() does not error on an already-missing
      // object — a real error here means a transient/permission problem.
      // Leave pending_deletion_at as-is so the NEXT run retries; do not
      // confirm/delete the metadata row (same "Storage object, then DB row"
      // order as partner_delete_document's own precedent).
      failedCount += 1
      failedPaths.push(row.storage_path)
      console.error(
        `purge-partner-documents: storage.remove failed for document=${row.document_id} ` +
          `path=${row.storage_path}: ${removeError.message}`,
      )
      continue
    }

    // Step 2b: THEN delete the metadata row.
    const { error: confirmError } = await adminClient.rpc('confirm_document_purged', {
      p_document_id: row.document_id,
    })
    if (confirmError) {
      failedCount += 1
      failedPaths.push(row.storage_path)
      console.error(
        `purge-partner-documents: confirm_document_purged failed for document=${row.document_id}: ${confirmError.message}`,
      )
      continue
    }

    deletedCount += 1
  }

  // Step 3: proof-of-erasure log (privacy review §5.1 "실행 결과를 retention_jobs에
  // 기록").
  const { error: recordError } = await adminClient.rpc('record_partner_document_purge_run', {
    p_deleted_count: deletedCount,
    p_failed_count: failedCount,
    p_notes:
      failedPaths.length > 0
        ? `Failed storage_paths (left queued for retry): ${failedPaths.slice(0, 20).join(', ')}`
        : null,
  })
  if (recordError) {
    console.error(`purge-partner-documents: record_partner_document_purge_run failed: ${recordError.message}`)
  }

  return NextResponse.json({ success: true, scanned: rows.length, deleted: deletedCount, failed: failedCount })
}
