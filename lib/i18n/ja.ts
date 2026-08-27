// Design Ref: copy.md ★ Recommended (Option A) — translated from en.ts, must implement identical Dictionary keys
import type { Dictionary } from './types'

export const ja: Dictionary = {
  meta: {
    title: 'Find Korean Partners — 信頼できる韓国企業とつながる',
    description:
      '韓国で探しているものをお知らせください。信頼できる韓国の企業、教育機関、サービスパートナーを比較・発見し、つながるお手伝いをします。',
  },
  header: {
    logo: 'Find Korean Partners',
    logoShort: 'FKP',
    requestNav: 'リクエスト',
    languageSwitcher: {
      en: 'EN',
      ja: 'JA',
      switchWarning: '言語を切り替えると、入力中のリクエスト内容が消去されます。続けますか？',
    },
  },
  hero: {
    headline: '貴社に最適な韓国のパートナーを見つけます。',
    subheadline:
      '韓国で探しているものをお知らせください。信頼できる韓国の企業、教育機関、サービスパートナーを比較・発見し、つながるお手伝いをします。',
    ctaText: 'リクエストを始める',
  },
  howItWorks: {
    title: 'ご利用の流れ',
    steps: [
      {
        title: 'リクエスト送信',
        description: 'どのような韓国のパートナーをお探しか教えてください。',
      },
      {
        title: 'リサーチ',
        description: 'ご要望に合う韓国企業を調査します。',
      },
      {
        title: '候補リスト',
        description: '最適な候補の比較表をお送りします。',
      },
      {
        title: 'マッチング',
        description: 'ご希望のパートナーとの面談・連絡をサポートします。',
      },
    ],
  },
  categories: {
    title: '対応カテゴリー',
    selectHint: 'このカテゴリーでリクエストを開始します',
    items: {
      education: {
        name: '教育・EdTech',
        keywords: ['韓国語教育', 'AI・コーディング教育', 'キャリアカウンセリング', 'LMS・eラーニング'],
      },
      'it-ai': {
        name: 'IT・AI',
        keywords: ['Web・アプリ開発', 'AI自動化', 'チャットボット', 'SaaSプラットフォーム'],
      },
      'content-media': {
        name: 'コンテンツ・メディア',
        keywords: ['動画制作', 'ショート動画コンテンツ', 'デザイン・ブランディング', '翻訳・ローカライズ'],
      },
      'beauty-lifestyle': {
        name: 'ビューティー・ライフスタイル',
        keywords: ['K-ビューティー製品', 'ライフスタイル商品', 'ブランド提携', '製造・調達'],
      },
      'business-services': {
        name: 'ビジネスサービス',
        keywords: ['マーケティング・PR', '市場調査', '韓国市場進出支援', 'コンサルティング'],
      },
    },
  },
  whyUs: {
    title: 'Find Korean Partnersが選ばれる理由',
    points: [
      {
        title: 'ご要望を丁寧に理解します',
        description:
          'パートナー探しの前に、ご要望をしっかり確認します。単なるリストではなく、より適切なマッチングにつながります。',
      },
      {
        title: '厳選した候補のみご提案',
        description: '候補の調査・比較は私たちが行います。短く的確な候補リストと推奨理由をお届けします。',
      },
      {
        title: '紹介後のサポートも提供',
        description: '必要に応じて、面談の設定や韓国側パートナーとのコミュニケーションをサポートします。',
      },
    ],
  },
  requestForm: {
    selectPlaceholder: '選択してください',
    step1: {
      label: 'ステップ1/3 — お探しのもの',
      whatLookingFor: {
        label: '韓国でお探しのものは何ですか？',
        placeholder: '例：AIカリキュラムのライセンス提供が可能な韓国のEdTech企業',
      },
      category: {
        label: 'ご要望に最も近いカテゴリーはどれですか？',
      },
    },
    step2: {
      label: 'ステップ2/3 — 詳細情報',
      partnerType: {
        label: 'どのようなパートナーをお探しですか？',
        options: {
          purchase: '製品・サービスの購入',
          partnership: 'ビジネス提携',
          license: 'コンテンツ・技術のライセンス',
          other: 'その他',
        },
      },
      purpose: {
        label: '目的を教えてください',
        placeholder: '例：自社オンラインプラットフォーム向けのカリキュラムライセンス',
      },
      description: {
        label: 'ご要望の詳細を記入してください',
        placeholder: '貴社の事業内容とお探しのものについて教えてください。',
      },
      budget: {
        label: 'ご予算の目安は？',
        options: {
          'under-500': '500ドル未満',
          '500-1500': '500〜1,500ドル',
          '1500-3000': '1,500〜3,000ドル',
          'over-3000': '3,000ドル以上',
          'not-sure': 'まだ未定',
        },
      },
      timeline: {
        label: 'ご希望のスケジュールは？',
        options: {
          asap: 'できるだけ早く',
          'within-1-month': '1ヶ月以内',
          '1-3-months': '1〜3ヶ月',
          '3-6-months': '3〜6ヶ月',
          flexible: '柔軟に対応可能',
        },
      },
      englishSpeaking: {
        label: '英語対応可能な韓国側パートナーが必要ですか？',
        options: {
          required: '必須',
          preferred: 'あれば望ましいが必須ではない',
          'not-needed': '不要',
        },
      },
    },
    step3: {
      label: 'ステップ3/3 — 連絡先情報',
      companyNameWebsite: {
        label: '会社名・ウェブサイト',
        placeholder: '例：Acme Inc. / https://acme.example.com',
      },
      contact: {
        label: '連絡先',
        placeholder: 'メールアドレス',
      },
      consent: {
        privacy: { before: '', linkText: 'プライバシーポリシー', after: 'に同意します。' },
        terms: { before: '', linkText: '利用規約', after: 'に同意します。' },
        marketingLabel: '（任意）お知らせ・アップデート情報の受信を希望します。',
      },
    },
    buttons: {
      next: '次へ',
      back: '戻る',
      submit: 'リクエストを送信',
      submitting: '送信中...',
      retry: '再試行',
      startNew: '新しいリクエストを始める',
    },
    validation: {
      required: 'このフィールドは必須です。',
      invalidEmail: '有効なメールアドレスを入力してください。',
      consentRequired: '続行するには、プライバシーポリシーと利用規約に同意してください。',
    },
    status: {
      success: 'ありがとうございます。リクエストを受け付けました。担当者よりご連絡いたします。',
      error: 'エラーが発生しました。もう一度お試しください。',
    },
    recap: {
      step1Label: '入力内容',
      step2Label: '詳細',
      editLabel: '編集',
    },
    confirmModal: {
      title: '内容をご確認ください',
      description: '以下の内容でリクエストを送信します。送信前にご確認ください。',
      sections: { step1: 'ご希望内容', step2: '詳細', step3: '連絡先' },
      confirmButton: '確認して送信',
      cancelButton: 'キャンセル',
    },
  },
  requestPage: {
    intro: '韓国で探しているものをお知らせください。最適なパートナーとのマッチングをサポートします。',
  },
  blog: {
    pageTitle: 'ブログ',
    emptyState: 'まだ投稿がありません。近日公開予定です。',
    backToList: '← ブログ一覧に戻る',
    ctaTitle: '韓国のパートナーをお探しですか？',
    ctaButton: 'リクエストを始める',
  },
  caseStudies: {
    pageTitle: '導入事例',
    emptyState: 'まだ事例がありません。近日公開予定です。',
    backToList: '← 事例一覧に戻る',
    ctaTitle: '韓国のパートナーをお探しですか？',
    ctaButton: 'リクエストを始める',
  },
  faq: {
    pageTitle: 'よくある質問',
    emptyState: 'まだ質問がありません。近日公開予定です。',
  },
  footer: {
    intro: 'Find Korean Partnersは、海外企業が信頼できる韓国の教育・IT・コンテンツ・サービスパートナーとつながることをサポートします。',
    contactEmail: 'jhc@ylia.io',
    privacyLinkText: 'プライバシーポリシー',
    termsLinkText: '利用規約',
    blogLinkText: 'ブログ',
    caseStudiesLinkText: '導入事例',
    faqLinkText: 'よくある質問',
  },
  legal: {
    backToHome: '← Find Korean Partners トップへ戻る',
  },
  cookieConsent: {
    before: '当サイトでは利用状況分析のためにCookieを使用しています。詳細は',
    linkText: 'プライバシーポリシー',
    after: 'をご覧ください。',
    accept: '同意する',
    decline: '同意しない',
  },
}
