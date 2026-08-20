import type {
  EventTicketingCommunications,
} from "@/lib/tickets/ticket-types"
import { parseEventTicketingCommunications } from "@/lib/tickets/ticket-types"
import { sendTransactionalEmail } from "@/lib/email/transactional-email"

export type TicketConfirmationLine = {
  ticketCode: string
  ticketTypeName: string
  attendeeName: string
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendEventOrderConfirmationEmail(input: {
  to: string
  purchaserName: string
  eventName: string
  orderNumber: string
  startAtLabel?: string | null
  kind: "confirmed" | "reserved" | "refunded" | "partial_refund"
  refundAmountLabel?: string | null
  lines: TicketConfirmationLine[]
  communications?: EventTicketingCommunications | null
}): Promise<{ sent: boolean; configured: boolean }> {
  const recipient = input.to.trim().toLowerCase()
  if (!recipient) {
    return { sent: false, configured: false }
  }

  const communications = parseEventTicketingCommunications(input.communications)
  const customMessage =
    input.kind === "reserved"
      ? communications.reservationMessage
      : input.kind === "confirmed"
        ? communications.confirmationMessage
        : null

  const intro =
    input.kind === "reserved"
      ? `We reserved your tickets for <strong>${escapeHtml(input.eventName)}</strong>. Payment will be collected at the event.`
      : input.kind === "refunded"
        ? `Your registration for <strong>${escapeHtml(input.eventName)}</strong> has been refunded. These tickets are no longer valid.`
        : input.kind === "partial_refund"
          ? `A partial refund was issued for your registration for <strong>${escapeHtml(input.eventName)}</strong>. Your tickets remain valid unless noted otherwise.`
          : `This is your registration confirmation for <strong>${escapeHtml(input.eventName)}</strong>.`

  const lineHtml = input.lines
    .map(
      (line) =>
        `<li><strong>${escapeHtml(line.ticketTypeName)}</strong> — ${escapeHtml(line.ticketCode)} (${escapeHtml(line.attendeeName)})</li>`
    )
    .join("")

  const html = `
    <p>Hi ${escapeHtml(input.purchaserName)},</p>
    <p>${intro}</p>
    ${customMessage ? `<p>${escapeHtml(customMessage).replaceAll("\n", "<br />")}</p>` : ""}
    <ul>
      <li><strong>Order:</strong> ${escapeHtml(input.orderNumber)}</li>
      ${input.startAtLabel ? `<li><strong>When:</strong> ${escapeHtml(input.startAtLabel)}</li>` : ""}
      ${input.refundAmountLabel ? `<li><strong>Refund:</strong> ${escapeHtml(input.refundAmountLabel)}</li>` : ""}
    </ul>
    <p>Tickets:</p>
    <ul>${lineHtml}</ul>
    <p>${
      input.kind === "refunded"
        ? "You do not need to bring these ticket codes to the event."
        : "Bring your ticket code to check in at the event."
    }</p>
  `

  const textIntro =
    input.kind === "reserved"
      ? `Tickets reserved for ${input.eventName}. Pay at the event.`
      : input.kind === "refunded"
        ? `Your registration for ${input.eventName} has been refunded. These tickets are no longer valid.`
        : input.kind === "partial_refund"
          ? `A partial refund was issued for ${input.eventName}. Your tickets remain valid.`
          : `Registration confirmation for ${input.eventName}.`

  const text = [
    `Hi ${input.purchaserName},`,
    textIntro,
    customMessage || "",
    `Order: ${input.orderNumber}`,
    input.startAtLabel ? `When: ${input.startAtLabel}` : "",
    input.refundAmountLabel ? `Refund: ${input.refundAmountLabel}` : "",
    ...input.lines.map(
      (line) => `${line.ticketTypeName}: ${line.ticketCode} (${line.attendeeName})`
    ),
    input.kind === "refunded"
      ? "You do not need to bring these ticket codes to the event."
      : "Bring your ticket code to check in at the event.",
  ]
    .filter(Boolean)
    .join("\n")

  const defaultSubject =
    input.kind === "reserved"
      ? `Ticket reservation for ${input.eventName}`
      : input.kind === "refunded"
        ? `Refund for ${input.eventName}`
        : input.kind === "partial_refund"
          ? `Partial refund for ${input.eventName}`
          : `Your registration for ${input.eventName}`

  const subject =
    input.kind === "reserved"
      ? communications.reservationSubject || defaultSubject
      : input.kind === "confirmed"
        ? communications.confirmationSubject || defaultSubject
        : defaultSubject

  const delivery = await sendTransactionalEmail({
    to: [recipient],
    subject,
    html,
    text,
  })

  return {
    sent: delivery.results.some((row) => row.sent) && delivery.configured,
    configured: delivery.configured,
  }
}
