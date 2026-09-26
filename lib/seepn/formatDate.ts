// yyyy.mm.dd (UTC 기준 날짜). Figma 공지·인사이트 목록의 날짜 표기.
export function formatDotDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replaceAll('-', '.')
}
