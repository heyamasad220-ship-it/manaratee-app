/** Pull a ticket code from a scanned QR payload (raw code or URL). */
export function ticketCodeFromQrPayload(raw: string | null | undefined): string | null {
  const trimmed = String(raw || "").trim()
  if (!trimmed) return null

  let candidate = trimmed
  try {
    const url = new URL(trimmed)
    candidate =
      url.searchParams.get("code") ||
      url.searchParams.get("ticket") ||
      url.searchParams.get("ticketCode") ||
      url.searchParams.get("ticket_code") ||
      url.pathname.split("/").filter(Boolean).pop() ||
      trimmed
  } catch {
    candidate = trimmed
  }

  const normalized = candidate.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (normalized.length < 4 || normalized.length > 24) {
    return null
  }

  return normalized
}
