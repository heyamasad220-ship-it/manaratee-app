import DOMPurify from "isomorphic-dompurify"

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "span",
  "div",
]

const ALLOWED_ATTR = ["style", "class", "dir"]

/** Escape plain text for safe HTML embedding. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Convert legacy plain-text descriptions into simple HTML paragraphs.
 * Existing HTML is returned as-is (then sanitized by callers).
 */
export function plainTextToHtml(value: string | null | undefined): string {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw

  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const lines = escapeHtml(block).replace(/\n/g, "<br>")
      return `<p>${lines}</p>`
    })
    .join("")
}

/** Sanitize rich description HTML for storage and display. */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  const raw = String(html || "").trim()
  if (!raw) return ""

  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }).trim()
}

/** True when HTML has no visible text. */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  const sanitized = sanitizeRichTextHtml(html)
  if (!sanitized) return true
  const text = sanitized
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length === 0
}
