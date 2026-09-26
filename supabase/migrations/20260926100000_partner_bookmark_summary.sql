-- =============================================================================
-- TOP100 '좋아요' 탭용 관심등록 집계 (2026-09-26)
--
-- 대표 결정: TOP100 좋아요 = 관심등록(♥) 수. 어느 회원이 관심등록했는지는 어떤 형태로도 노출하지
-- 않고 공급사별 총 건수만 집계한다(처리방침 제7조 '파트너가 알 수 있는 것: 자사를 관심등록한 총
-- 건수(집계된 숫자)'와 동일한 수준). 활성 회원의 관심등록만, 공개 목록 공급사만 센다. 비로그인
-- TOP100 화면에서 읽으므로 anon 조회를 허용한다(집계뿐이라 개별 행이 없다).
--
-- Re-runnable. Not yet executed against Supabase — paste into the SQL Editor manually.
-- =============================================================================

drop view if exists public.partner_bookmark_summary;
create view public.partner_bookmark_summary as
select
  b.partner_id,
  count(*)::integer as bookmark_count
from public.buyer_bookmark b
join public.buyer_account ba on ba.id = b.buyer_account_id and ba.status = 'active'
where b.partner_id in (select pl.id from public.partner_list_public pl)
group by b.partner_id;

revoke all on public.partner_bookmark_summary from public, anon, authenticated;
grant select on public.partner_bookmark_summary to anon, authenticated;
