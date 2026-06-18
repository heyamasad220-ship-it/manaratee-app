export type PaymentMatchQueueItem = {
  id: string
  source: string
  senderName: string
  amount: number
  date: string | null
  memo: string
  status: "pending_review" | "unallocated" | "unresolved"
  donorId: string | null
  contactId: string | null
  importEmail: string | null
  importPhone: string | null
}

export type ImportPaymentCsvResult = {
  batchId: string
  imported: number
  duplicates: number
  invalid: number
}
