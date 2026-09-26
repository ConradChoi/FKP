-- =============================================================================
-- SEEPN 인사이트·FAQ 콘텐츠 유형 (2026-09-25)
--
-- content_item.content_type CHECK에 'seepn_insight'(한국어 아티클: title/excerpt/category/
-- body_markdown)와 'seepn_faq'(한국어 Q/A: question/answer)를 추가한다. 기존 'faq'는 FKP 해외
-- 바이어용 en/ja 공개 FAQ라 재사용하지 않는다(언어·독자·게시 경로가 다르고, ko 번역 행이 FKP FAQ에
-- 섞여 노출될 위험을 원천 차단). 두 유형 모두 ko 단일 언어이며 target_audience는 NULL이다.
-- create_content_item / upsert_content_translation 등 기존 RPC는 유형에 무관하게 그대로 쓴다.
--
-- Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

alter table public.content_item drop constraint if exists content_item_content_type_check;

alter table public.content_item
  add constraint content_item_content_type_check
  check (content_type in ('landing_copy', 'notice', 'case_study', 'faq', 'seepn_insight', 'seepn_faq'));
