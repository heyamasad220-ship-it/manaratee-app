/** Integer-cent helpers. Do not use floating point for money math. */

export function formatCentsAsUsd(cents: number): string {
  const negative = cents < 0
  const absolute = Math.abs(Math.trunc(cents))
  const dollars = Math.floor(absolute / 100)
  const remainder = absolute % 100
  const formatted = `$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`
  return negative ? `-${formatted}` : formatted
}

export function formatCentsAsUsdMonthly(cents: number): string {
  return `${formatCentsAsUsd(cents)}/month`
}

export function parseUsdToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,]/g, "")
  if (!cleaned) return null
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const dollars = Number(match[1])
  const centsPart = (match[2] ?? "00").padEnd(2, "0")
  if (!Number.isInteger(dollars) || dollars < 0) return null
  return dollars * 100 + Number(centsPart)
}

export function dollarsInputFromCents(cents: number): string {
  const absolute = Math.abs(Math.trunc(cents))
  const dollars = Math.floor(absolute / 100)
  const remainder = absolute % 100
  return `${dollars}.${String(remainder).padStart(2, "0")}`
}

export function percentOfCents(cents: number, percent: number): number {
  if (cents === 0 || percent === 0) return 0
  return Math.trunc((Math.trunc(cents) * Math.trunc(percent)) / 100)
}
