// Design Ref: docs/02-design/features/admin-ai-translation-draft.screen-spec.md §6.3 —
// "Google Translate 호출부 위치 — 서버 전용 모듈 격리 권고". privacy-security-officer S-1
// ("번역 API 호출은 반드시 서버에서만") plus a real incident already logged against this repo
// (project memory: 'use client' 파일에 상수/헬퍼를 같이 두면 서버에서 조용히 빈 값으로 읽힘)
// are why this file exists on its own, with no 'use client' directive anywhere near it and no
// import from any 'use client' component.
//
// DO NOT import this module from a 'use client' file. It holds/derives Google Cloud service
// account credentials (via GOOGLE_TRANSLATE_CREDENTIALS_JSON) — pulling it into a client bundle
// would be a credential leak, not just a bug.
//
// Tier: Google Cloud Translation ADVANCED (v3), per ceo-advisor approval
// (google-translation-api-evaluation.md §8.3 — "Advanced(v3) + 향후 글로서리 지원"), NOT Basic
// (v2). v3 requires a service account (project + credentials), which is why this uses
// `@google-cloud/translate`'s `v3.TranslationServiceClient` and not its `v2.Translate` class —
// using v2 here would silently contradict the approved tier.
//
// Credentials do not exist in this project yet (as of 2026-09-08). Until GOOGLE_TRANSLATE_
// PROJECT_ID / GOOGLE_TRANSLATE_CREDENTIALS_JSON are set (see below) AND listed in
// next.config.js's `env` block — this repo's confirmed AWS Amplify SSR bug means non-
// NEXT_PUBLIC_ env vars set only in the Amplify console never reach SSR runtime `process.env`
// otherwise (project memory: amplify_env_var_bug.md) — every call into this module returns
// { ok: false, errorCode: 'CONFIG_ERROR' } WITHOUT ever calling the real API. That is the
// correct, expected behavior right now, not a bug to "fix" by relaxing the check.
//
// Required environment variables (also add to next.config.js's `env` block — see above):
//   - GOOGLE_TRANSLATE_PROJECT_ID        GCP project id that owns the Translation API.
//   - GOOGLE_TRANSLATE_CREDENTIALS_JSON  The FULL service-account key JSON, as one string
//                                        (not a file path — `GOOGLE_APPLICATION_CREDENTIALS`
//                                        file-path auth does not work on Amplify SSR compute,
//                                        there is no persistent filesystem to point it at).
// Optional:
//   - GOOGLE_TRANSLATE_LOCATION          Translation API location (default 'global').
//   - GOOGLE_TRANSLATE_TIMEOUT_MS        Per-call timeout in ms (default 15000).

import { v3 } from '@google-cloud/translate'

export type GoogleTranslateErrorCode =
  | 'CONFIG_ERROR'
  | 'TRANSLATE_TIMEOUT'
  | 'RATE_LIMITED'
  | 'TRANSLATE_API_ERROR'

export type TranslateBatchResult =
  | { ok: true; translations: string[] }
  | { ok: false; errorCode: GoogleTranslateErrorCode; message?: string }

export type TranslateOneResult =
  | { ok: true; translation: string }
  | { ok: false; errorCode: GoogleTranslateErrorCode; message?: string }

// This app's translation tables all use the CHECK-constrained locale set ('en','ja','ko','zh')
// — map those to the BCP-47-ish codes the Translation API expects. zh is included for schema
// completeness even though no admin screen currently exposes a zh edit card (screen-spec §1.3).
const LOCALE_TO_GOOGLE_LANGUAGE: Record<string, string> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  zh: 'zh-CN',
}

const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_LOCATION = 'global'

interface TranslateConfig {
  projectId: string
  location: string
  timeoutMs: number
  credentials: Record<string, unknown>
}

function parseConfig(): TranslateConfig | null {
  const projectId = process.env.GOOGLE_TRANSLATE_PROJECT_ID?.trim()
  const rawCredentials = process.env.GOOGLE_TRANSLATE_CREDENTIALS_JSON

  if (!projectId || !rawCredentials) return null

  let credentials: unknown
  try {
    credentials = JSON.parse(rawCredentials)
  } catch {
    return null
  }
  if (!credentials || typeof credentials !== 'object') return null

  const location = process.env.GOOGLE_TRANSLATE_LOCATION?.trim() || DEFAULT_LOCATION
  const parsedTimeout = Number(process.env.GOOGLE_TRANSLATE_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS

  return { projectId, location, timeoutMs, credentials: credentials as Record<string, unknown> }
}

// Module-level cache so we don't re-parse the credentials JSON / re-construct a gRPC client on
// every single server action invocation. Safe across requests in the same server process —
// credentials only change on redeploy (new process), never mid-request.
let cachedClient: { client: v3.TranslationServiceClient; config: TranslateConfig } | null = null

function getClient(): { client: v3.TranslationServiceClient; config: TranslateConfig } | null {
  const config = parseConfig()
  if (!config) return null

  if (cachedClient && cachedClient.config.projectId === config.projectId) {
    return cachedClient
  }

  const client = new v3.TranslationServiceClient({
    projectId: config.projectId,
    credentials: config.credentials as { client_email?: string; private_key?: string },
  })
  cachedClient = { client, config }
  return cachedClient
}

function mapError(error: unknown): { errorCode: GoogleTranslateErrorCode; message?: string } {
  const grpcCode = (error as { code?: number } | null | undefined)?.code
  const message = error instanceof Error ? error.message : undefined
  // gRPC status codes (google-gax throws these as `.code` on the Error object):
  //   4  = DEADLINE_EXCEEDED, 8 = RESOURCE_EXHAUSTED. 429 covers the REST/fallback transport
  //   case, where google-gax may surface the raw HTTP status instead of the gRPC code.
  if (grpcCode === 4) return { errorCode: 'TRANSLATE_TIMEOUT', message }
  if (grpcCode === 8 || grpcCode === 429) return { errorCode: 'RATE_LIMITED', message }
  return { errorCode: 'TRANSLATE_API_ERROR', message }
}

export interface TranslateBatchInput {
  texts: string[]
  sourceLocale: string
  targetLocale: string
}

// Translates every entry of `texts` in ONE Translation API call (screen-spec §6.2 step 5 —
// "여러 필드/키워드를 한 API 호출에 배열로 담는 것은... '버튼 1클릭 = 서버 액션 1회 호출'의
// 구현 디테일이므로 원칙 위반 아님"). Blank entries (after trim) are passed through unchanged
// WITHOUT being sent to the API (screen-spec E-16 — an empty keyword stays empty, not an
// error), and order is preserved 1:1 with the input array.
export async function translateBatch(input: TranslateBatchInput): Promise<TranslateBatchResult> {
  const resolved = getClient()
  if (!resolved) {
    return { ok: false, errorCode: 'CONFIG_ERROR', message: 'google_translate_credentials_missing' }
  }

  const sourceLanguageCode = LOCALE_TO_GOOGLE_LANGUAGE[input.sourceLocale]
  const targetLanguageCode = LOCALE_TO_GOOGLE_LANGUAGE[input.targetLocale]
  if (!sourceLanguageCode || !targetLanguageCode) {
    return { ok: false, errorCode: 'CONFIG_ERROR', message: `unsupported_locale:${input.sourceLocale}->${input.targetLocale}` }
  }

  const indices: number[] = []
  const contents: string[] = []
  input.texts.forEach((text, i) => {
    if (text.trim() !== '') {
      indices.push(i)
      contents.push(text)
    }
  })

  if (contents.length === 0) {
    return { ok: true, translations: [...input.texts] }
  }

  const { client, config } = resolved

  try {
    const [response] = await client.translateText(
      {
        parent: client.locationPath(config.projectId, config.location),
        contents,
        mimeType: 'text/plain',
        sourceLanguageCode,
        targetLanguageCode,
      },
      { timeout: config.timeoutMs },
    )

    const translatedContents = (response.translations ?? []).map((t) => t.translatedText ?? '')
    if (translatedContents.length !== contents.length) {
      return { ok: false, errorCode: 'TRANSLATE_API_ERROR', message: 'translation_count_mismatch' }
    }

    const result = [...input.texts]
    indices.forEach((originalIndex, i) => {
      result[originalIndex] = translatedContents[i]
    })
    return { ok: true, translations: result }
  } catch (error) {
    return { ok: false, ...mapError(error) }
  }
}

// Convenience wrapper for the common single-field case (landing copy text, category name,
// standard category name, etc.) — built on translateBatch so there is exactly one error-mapping
// path for the whole module.
export async function translateOne(input: {
  text: string
  sourceLocale: string
  targetLocale: string
}): Promise<TranslateOneResult> {
  const result = await translateBatch({
    texts: [input.text],
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
  })
  if (!result.ok) return result
  return { ok: true, translation: result.translations[0] ?? '' }
}
