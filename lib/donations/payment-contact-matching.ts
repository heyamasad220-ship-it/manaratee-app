import { normalizeEmail, normalizePhone, normalizeText } from "@/lib/donations/payment-import-csv"

export type PaymentMatchHints = {
  senderName: string
  email?: string | null
  phone?: string | null
}

export type ContactMatchInput = {
  contactId: string
  donorId?: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  totalDonations?: number
  lastDonation?: string | null
}

export type ContactMatchResult = {
  contactId: string
  donorId: string | null
  name: string
  email: string
  phone: string
  totalDonations: number
  lastDonation: string
  confidenceScore: number
  matchReason: string
}

export function normalizeName(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getNameParts(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
}

export function calculateNameMatchScore(paymentName: string, contactName: string) {
  const paymentNormalized = normalizeName(paymentName)
  const contactNormalized = normalizeName(contactName)

  if (!paymentNormalized || !contactNormalized) {
    return { score: 0, reason: "No usable name" }
  }

  if (paymentNormalized === contactNormalized) {
    return { score: 95, reason: "Exact name match" }
  }

  const paymentParts = getNameParts(paymentName)
  const contactParts = getNameParts(contactName)
  const sharedParts = paymentParts.filter((part) => contactParts.includes(part))
  const sharedCount = sharedParts.length

  if (sharedCount === 0) return { score: 0, reason: "No name match" }

  if (sharedCount === paymentParts.length || sharedCount === contactParts.length) {
    return { score: 85, reason: "Strong partial name match" }
  }

  if (sharedCount >= 2) {
    return { score: 72, reason: "Multi-word partial name match" }
  }

  return { score: 58, reason: `Single-word match (${sharedParts[0]})` }
}

export function scoreContactMatch(
  hints: PaymentMatchHints,
  contact: ContactMatchInput
): ContactMatchResult | null {
  const paymentEmail = normalizeEmail(hints.email)
  const paymentPhone = normalizePhone(hints.phone)
  const contactEmail = normalizeEmail(contact.email)
  const contactPhone = normalizePhone(contact.phone)

  let score = 0
  let reason = ""

  if (paymentEmail && contactEmail && paymentEmail === contactEmail) {
    score = 98
    reason = "Exact email match"
  } else if (paymentPhone && contactPhone && paymentPhone.length >= 7 && paymentPhone === contactPhone) {
    score = 96
    reason = "Exact phone match"
  } else {
    const nameMatch = calculateNameMatchScore(hints.senderName, contact.full_name || "")
    score = nameMatch.score
    reason = nameMatch.reason
  }

  if (score <= 0) return null

  return {
    contactId: contact.contactId,
    donorId: contact.donorId ?? null,
    name: contact.full_name || "Unnamed contact",
    email: contact.email || "",
    phone: contact.phone || "",
    totalDonations: contact.totalDonations ?? 0,
    lastDonation: contact.lastDonation || "",
    confidenceScore: score,
    matchReason: reason,
  }
}

export function rankContactMatches(
  hints: PaymentMatchHints,
  contacts: ContactMatchInput[],
  limit = 5
): ContactMatchResult[] {
  const scored = contacts
    .map((contact) => scoreContactMatch(hints, contact))
    .filter((match): match is ContactMatchResult => match !== null)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)

  const uniqueByContact = new Map<string, ContactMatchResult>()
  for (const match of scored) {
    if (!uniqueByContact.has(match.contactId)) {
      uniqueByContact.set(match.contactId, match)
    }
  }

  return Array.from(uniqueByContact.values()).slice(0, limit)
}

export function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

export function buildContactSearchFilter(parts: string[]) {
  return parts
    .slice(0, 2)
    .map((part) => {
      const term = `%${escapeIlike(part)}%`
      return `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`
    })
    .join(",")
}

export function buildManualSearchFilter(search: string) {
  const term = `%${escapeIlike(search.trim())}%`
  return `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`
}

export function isAutoMatchEligible(matches: ContactMatchResult[], minScore = 85) {
  if (matches.length === 0) return false
  const top = matches[0]
  if (top.confidenceScore < minScore) return false
  if (matches.length > 1 && matches[1].confidenceScore === top.confidenceScore) return false
  return true
}
