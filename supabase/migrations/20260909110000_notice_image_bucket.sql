-- =============================================================================
-- Notice board (공지사항) — WS-3: public content-image Storage bucket for the
-- rich-text editor's image upload feature (N-R16 / D-N0-6).
-- =============================================================================
--
-- Design Ref:
--   - docs/01-plan/features/notice-board-v1.0.prd.md (v3.0 Final) §7.6 (image pipeline
--     direction), §9 NS-5 (public-read bucket implications).
--   - docs/03-security/notice-board-privacy-review.md §2 (전체 — this migration implements
--     that section's DDL close to verbatim), §0.2 NB-B1/NB-B2/NB-B4 (blocking gates).
--   - Baseline: partner-supplier-app-ui-privacy-review.md UI-B4 (server-route upload +
--     magic-byte check) / PR-2 (Storage RLS path convention) — see
--     20260829140000_partner_schema.sql §8b for the bucket this one is DELIBERATELY THE
--     OPPOSITE OF (see the comment block immediately below).
--
-- =============================================================================
-- READ THIS BEFORE TOUCHING EITHER BUCKET'S POLICIES (privacy review NB-R3):
--
--   partner-doc     = PRIVATE. public=false, signed URLs (expire), owner+admin SELECT only,
--                      admin has NO direct Storage INSERT/DELETE (goes through service_role,
--                      see uploadPartnerDocumentAction in
--                      app/admin/(protected)/partners/[id]/actions.ts), purge cron
--                      (20260904100000), statutory retention concerns (PR-2).
--   content-image   = PUBLIC. public=true, URLs never expire, admin has DIRECT Storage
--                      INSERT/DELETE via their own JWT (this file's policies below), NO
--                      SELECT policy at all (see NB-B1 note), no purge cron, no retention
--                      concern (content is assumed to carry no PII — NS-5/§2.6).
--
--   These two buckets exist because a single ADMIN persona in this app has two structurally
--   opposite storage problems (one confidential+ephemeral-URL, one public+permanent-URL), not
--   because one is "the improved version" of the other. Do NOT copy a policy from one bucket
--   to the other as a shortcut — every field where they differ (public flag, SELECT policy
--   presence, INSERT/DELETE grantee, service_role usage) differs on purpose. If you find
--   yourself about to write `to authenticated ... using (bucket_id = 'content-image' ...)`
--   for a SELECT policy, or about to route content-image uploads through
--   getSupabaseAdminClient()/service_role, stop and re-read §2.2 of the privacy review first —
--   both of those are "looks obviously right, is actually the specific mistake this document
--   calls out" traps (NB-B1, NB-B4).
-- =============================================================================
--
-- STATUS: not yet applied — run manually via Supabase console per this project's existing
-- workflow (repo memory: local-only verification during the SEEPN integration arc). Apply after
-- 20260909100000_notice_target_audience_lock.sql (no hard dependency, just chronological order).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Bucket definition (privacy review §2.1)
-- ---------------------------------------------------------------------------
-- Bucket-level allowed_mime_types/file_size_limit are DEFENSE-IN-DEPTH ONLY — a declared
-- Content-Type header is spoofable by the caller, exactly like partner-doc's own §4a comment
-- says (20260904100000_supplier_app_privacy_fixes.sql:489-493). The actual control is the
-- server-side magic-byte check (lib/forms/fileSignature.ts's detectImageMimeType, used by
-- uploadNoticeImageAction in app/admin/(protected)/board/actions.ts) BEFORE these bytes ever
-- reach Storage. webp is intentionally NOT in the allow-list — see detectImageMimeType's own
-- comment for why (its magic-byte check can't safely distinguish webp from other RIFF
-- containers with only a leading-bytes look).
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'content-image',
  'content-image',
  true,
  array['image/jpeg', 'image/png'],
  2097152 -- 2MB (privacy review §2.1 "보수적으로 시작" — PRD §7.6 same guidance)
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. storage.objects RLS — INSERT/DELETE only, NO SELECT policy (NB-B1, blocking)
-- ---------------------------------------------------------------------------
-- Why no SELECT policy: this bucket is public=true, which means reading an object by its
-- direct URL (getPublicUrl()) NEVER goes through storage.objects RLS at all — RLS only
-- gates the Storage HTTP API's authenticated operations (list/insert/update/delete). Adding
-- a SELECT policy here would not be "allowing reads" (reads already work with zero policies,
-- by virtue of public=true) — it would instead enable the LIST endpoint
-- (`/storage/v1/object/list/content-image`), letting any caller who can satisfy that policy's
-- predicate enumerate every object in the bucket by folder-walking. Since object filenames are
-- server-generated UUIDs specifically so they can't be guessed (§3 below), an open LIST
-- endpoint would defeat that randomization completely — this is the single most likely
-- "looks like the right fix" mistake for this bucket (privacy review §2.2, NB-B1).
--
-- qa-reviewer MUST verify (NB-R8): calling
-- `GET {supabase_url}/storage/v1/object/list/content-image` with the anon key is rejected
-- (no matching policy = deny-by-absence, the same posture private.partner_consent_meta already
-- documents for having no SELECT policy at all).

create policy content_image_admin_insert on storage.objects
  for insert to authenticated
  with check (
    case when bucket_id = 'content-image'
      then (select private.is_active_admin())
       and (select private.is_aal2())
       and (select private.has_menu_permission('content_management', 'create'))
      else false
    end
  );

create policy content_image_admin_delete on storage.objects
  for delete to authenticated
  using (
    case when bucket_id = 'content-image'
      then (select private.is_active_admin())
       and (select private.is_aal2())
       and (select private.has_menu_permission('content_management', 'delete'))
      else false
    end
  );

-- No UPDATE policy — objects are immutable once written (replace = delete + re-upload),
-- matching partner-doc's own stance (20260829140000 §8b comment (3)).
--
-- The `case when bucket_id = 'content-image' then ... else false end` guard on both policies
-- above (rather than a plain `bucket_id = 'content-image' and ...`) matches partner-doc's own
-- established pattern (qa-reviewer caught the missing guard there on 2026-08-30) — it ensures
-- a future bucket whose predicate errors out on this row's shape (e.g. a folder-segment cast
-- that assumes a different path convention) still fails CLOSED for this bucket, not open.
--
-- Both policies are granted `to authenticated` (never `anon`, never a broader role) — the
-- caller must ALSO satisfy is_active_admin() + is_aal2() + has_menu_permission(...) inside the
-- predicate, so a plain logged-in partner (also `authenticated` role) cannot write here; only
-- an admin session holding content_management create/delete can. This is what lets
-- uploadNoticeImageAction/deleteNoticeImageAction (app/admin/(protected)/board/actions.ts) use
-- the admin's own JWT (getSupabaseAuthServerClient()) directly for the Storage write, instead
-- of a service_role client (NB-B4 — "관리자 본인 JWT로 Storage에 쓰게 해서 storage.objects
-- RLS가 실제 통제선이 되게 한다"). Do not add a service_role path for this bucket; if these
-- policies are ever insufficient, fix the policy predicate, don't route around it.


-- ---------------------------------------------------------------------------
-- 3. Path convention (documented here, enforced in application code)
-- ---------------------------------------------------------------------------
-- content-image/{content_item_id}/{uuid}.{ext}
--                ^^^^^^^^^^^^^^^^ organizational only — unlike partner-doc's
--                                 {partner_id} folder segment (which the RLS above
--                                 cross-checks via private.owns_partner()), this segment is
--                                 NOT an access-control boundary here — every object in this
--                                 bucket is equally public regardless of which folder it's in
--                                 (privacy review §2.3: "폴더 세그먼트가 접근 통제 역할을
--                                 하지 않는다"). It exists purely so an admin can find/delete
--                                 all images belonging to one notice.
--                                 ^^^^ server-generated randomUUID() — NEVER the original
--                                      filename (NB-B2: a real filename is itself information,
--                                      e.g. "사업자등록증_OO주식회사.png", and a guessable
--                                      name in a public+unlisted bucket is a de facto second
--                                      access path around the missing SELECT/LIST policy above).
--                                      ext is derived from the DETECTED mime type
--                                      (extensionForDocumentMimeType), never a client-declared
--                                      extension.

-- =============================================================================
-- End of notice image bucket migration.
-- =============================================================================
