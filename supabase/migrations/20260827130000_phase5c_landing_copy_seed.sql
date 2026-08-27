-- =============================================================================
-- FKP v0.2 Phase 5-C — landing copy seed (content_item / content_translation)
-- =============================================================================
--
-- Design Ref: 대표 확정(2026-08-27 사용자 확인): 5-C 관리자 UI 범위는 "마케팅 카피만"
-- (hero, howItWorks, whyUs, footer 소개) — requestForm 버튼/검증 메시지 등 UI 기능 문구는
-- lib/i18n 정적 사전에 그대로 둔다.
--
-- One content_item per single text field (not per section) — matches the body shape
-- documented on content_translation in 20260827100000 (`landing_copy: {"text": "..."}`).
-- This keeps every landing_copy row's body shape uniform and each admin-editable field
-- independent (editing one howItWorks step doesn't touch the others' translation status).
--
-- Content is copied verbatim from lib/i18n/en.ts and lib/i18n/ja.ts (current live copy),
-- status='published', source_synced_at=now() for both locales — this is a lift of
-- already-live text into the DB, not new draft content.
-- =============================================================================

insert into public.content_item (content_type, content_key, source_locale, sort_order) values
  ('landing_copy', 'landing.hero.headline', 'en', 10),
  ('landing_copy', 'landing.hero.subheadline', 'en', 20),
  ('landing_copy', 'landing.hero.cta', 'en', 30),

  ('landing_copy', 'landing.how_it_works.title', 'en', 40),
  ('landing_copy', 'landing.how_it_works.step_1.title', 'en', 41),
  ('landing_copy', 'landing.how_it_works.step_1.description', 'en', 42),
  ('landing_copy', 'landing.how_it_works.step_2.title', 'en', 43),
  ('landing_copy', 'landing.how_it_works.step_2.description', 'en', 44),
  ('landing_copy', 'landing.how_it_works.step_3.title', 'en', 45),
  ('landing_copy', 'landing.how_it_works.step_3.description', 'en', 46),
  ('landing_copy', 'landing.how_it_works.step_4.title', 'en', 47),
  ('landing_copy', 'landing.how_it_works.step_4.description', 'en', 48),

  ('landing_copy', 'landing.why_us.title', 'en', 50),
  ('landing_copy', 'landing.why_us.point_1.title', 'en', 51),
  ('landing_copy', 'landing.why_us.point_1.description', 'en', 52),
  ('landing_copy', 'landing.why_us.point_2.title', 'en', 53),
  ('landing_copy', 'landing.why_us.point_2.description', 'en', 54),
  ('landing_copy', 'landing.why_us.point_3.title', 'en', 55),
  ('landing_copy', 'landing.why_us.point_3.description', 'en', 56),

  ('landing_copy', 'landing.footer.intro', 'en', 60)
on conflict (content_key) do nothing;

with items as (
  select id, content_key from public.content_item where content_type = 'landing_copy'
),
seed (content_key, locale, text_en, text_ja) as (
  values
    ('landing.hero.headline', 'en',
      'Find the right Korean partner for your business.', null),
    ('landing.hero.headline', 'ja', null,
      '貴社に最適な韓国のパートナーを見つけます。'),

    ('landing.hero.subheadline', 'en',
      'Tell us what you are looking for in Korea. We help you discover, compare, and connect with trusted Korean companies, education providers, and service partners.', null),
    ('landing.hero.subheadline', 'ja', null,
      '韓国で探しているものをお知らせください。信頼できる韓国の企業、教育機関、サービスパートナーを比較・発見し、つながるお手伝いをします。'),

    ('landing.hero.cta', 'en', 'Start My Request', null),
    ('landing.hero.cta', 'ja', null, 'リクエストを始める'),

    ('landing.how_it_works.title', 'en', 'How It Works', null),
    ('landing.how_it_works.title', 'ja', null, 'ご利用の流れ'),

    ('landing.how_it_works.step_1.title', 'en', 'Submit Request', null),
    ('landing.how_it_works.step_1.title', 'ja', null, 'リクエスト送信'),
    ('landing.how_it_works.step_1.description', 'en', 'Tell us what kind of Korean partner you are looking for.', null),
    ('landing.how_it_works.step_1.description', 'ja', null, 'どのような韓国のパートナーをお探しか教えてください。'),

    ('landing.how_it_works.step_2.title', 'en', 'We Research', null),
    ('landing.how_it_works.step_2.title', 'ja', null, 'リサーチ'),
    ('landing.how_it_works.step_2.description', 'en', 'We look for Korean companies that match your request.', null),
    ('landing.how_it_works.step_2.description', 'ja', null, 'ご要望に合う韓国企業を調査します。'),

    ('landing.how_it_works.step_3.title', 'en', 'Get Shortlist', null),
    ('landing.how_it_works.step_3.title', 'ja', null, '候補リスト'),
    ('landing.how_it_works.step_3.description', 'en', 'We send you a comparison of the best-fit candidates.', null),
    ('landing.how_it_works.step_3.description', 'ja', null, '最適な候補の比較表をお送りします。'),

    ('landing.how_it_works.step_4.title', 'en', 'We Connect', null),
    ('landing.how_it_works.step_4.title', 'ja', null, 'マッチング'),
    ('landing.how_it_works.step_4.description', 'en', 'We help set up meetings and communication with your chosen partner.', null),
    ('landing.how_it_works.step_4.description', 'ja', null, 'ご希望のパートナーとの面談・連絡をサポートします。'),

    ('landing.why_us.title', 'en', 'Why Find Korean Partners', null),
    ('landing.why_us.title', 'ja', null, 'Find Korean Partnersが選ばれる理由'),

    ('landing.why_us.point_1.title', 'en', 'We Understand Your Needs', null),
    ('landing.why_us.point_1.title', 'ja', null, 'ご要望を丁寧に理解します'),
    ('landing.why_us.point_1.description', 'en',
      'We take time to clarify your request before searching for partners. This means better matches, not just a long list.', null),
    ('landing.why_us.point_1.description', 'ja', null,
      'パートナー探しの前に、ご要望をしっかり確認します。単なるリストではなく、より適切なマッチングにつながります。'),

    ('landing.why_us.point_2.title', 'en', 'Curated, Not Just Listed', null),
    ('landing.why_us.point_2.title', 'ja', null, '厳選した候補のみご提案'),
    ('landing.why_us.point_2.description', 'en',
      'We research and compare candidates so you don''t have to. You get a short, relevant list with clear recommendations.', null),
    ('landing.why_us.point_2.description', 'ja', null,
      '候補の調査・比較は私たちが行います。短く的確な候補リストと推奨理由をお届けします。'),

    ('landing.why_us.point_3.title', 'en', 'Support Beyond Introductions', null),
    ('landing.why_us.point_3.title', 'ja', null, '紹介後のサポートも提供'),
    ('landing.why_us.point_3.description', 'en',
      'If needed, we help schedule meetings and support communication between you and your Korean partner.', null),
    ('landing.why_us.point_3.description', 'ja', null,
      '必要に応じて、面談の設定や韓国側パートナーとのコミュニケーションをサポートします。'),

    ('landing.footer.intro', 'en',
      'Find Korean Partners helps global companies connect with trusted Korean education, IT, content, and service partners.', null),
    ('landing.footer.intro', 'ja', null,
      'Find Korean Partnersは、海外企業が信頼できる韓国の教育・IT・コンテンツ・サービスパートナーとつながることをサポートします。')
)
insert into public.content_translation (content_item_id, locale, body, status, source_synced_at)
select
  items.id,
  seed.locale,
  jsonb_build_object('text', coalesce(seed.text_en, seed.text_ja)),
  'published',
  now()
from seed
join items on items.content_key = seed.content_key
on conflict (content_item_id, locale) do nothing;
