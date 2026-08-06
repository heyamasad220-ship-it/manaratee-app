export type SocialLinkSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }

function ensureHttpUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  if (/^(instagram|facebook|fb|tiktok|x|twitter|linkedin)\.com\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return null
}

function instagramUrlFromHandle(handle: string) {
  const clean = handle.replace(/^@/, "").trim()
  if (!clean) return null
  return `https://www.instagram.com/${encodeURIComponent(clean)}`
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.,;:!?)]+$/g, "")
}

/**
 * Turn free-form social / website notes into clickable segments.
 * Supports URLs, www hosts, Instagram @handles, and "Instagram: handle".
 */
export function parseSocialLinkSegments(input: string | null | undefined): SocialLinkSegment[] {
  const text = String(input || "").trim()
  if (!text) return []

  const pattern =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(instagram\s*(?:@|:)\s*)(@?[A-Za-z0-9._]{2,})|(@[A-Za-z0-9._]{2,})/gi

  const segments: SocialLinkSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }

    const full = match[0]
    const urlCandidate = match[1] || match[2]
    const igLabel = match[3]
    const igHandle = match[4] || match[5]

    if (urlCandidate) {
      const cleaned = stripTrailingPunctuation(urlCandidate)
      const href = ensureHttpUrl(cleaned)
      if (href) {
        segments.push({ type: "link", value: cleaned, href })
        const trailing = urlCandidate.slice(cleaned.length)
        if (trailing) segments.push({ type: "text", value: trailing })
      } else {
        segments.push({ type: "text", value: full })
      }
    } else if (igHandle) {
      const cleaned = stripTrailingPunctuation(igHandle)
      const href = instagramUrlFromHandle(cleaned)
      if (href) {
        if (igLabel) segments.push({ type: "text", value: igLabel })
        segments.push({
          type: "link",
          value: cleaned.startsWith("@") ? cleaned : `@${cleaned}`,
          href,
        })
      } else {
        segments.push({ type: "text", value: full })
      }
    } else {
      segments.push({ type: "text", value: full })
    }

    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }]
}
