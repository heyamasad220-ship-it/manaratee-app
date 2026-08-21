"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  loadContactFundDevelopmentHistoryAction,
  type ContactFundDevelopmentHistoryItem,
} from "@/lib/contacts/contact-fund-development-history-actions"

type ContactFundDevelopmentHistoryProps = {
  contactId: string | null | undefined
  enabled: boolean
}

function formatHistoryDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ContactFundDevelopmentHistory({
  contactId,
  enabled,
}: ContactFundDevelopmentHistoryProps) {
  const [items, setItems] = useState<ContactFundDevelopmentHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !contactId) {
      setItems([])
      setHidden(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)
    const result = await loadContactFundDevelopmentHistoryAction(contactId)
    if (!result.success) {
      if ("denied" in result && result.denied) {
        setHidden(true)
        setItems([])
      } else {
        setHidden(false)
        setErrorMessage(result.error)
        setItems([])
      }
      setLoading(false)
      return
    }

    setHidden(false)
    setItems(result.items)
    setLoading(false)
  }, [contactId, enabled])

  useEffect(() => {
    void load()
  }, [load])

  if (!enabled || !contactId || hidden) return null

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fund Development</CardTitle>
        <CardDescription>
          Campaign prospects, assignments, and group donation attribution
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading Fund Development history…</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaign prospect or group giving history for this contact yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link href={item.href} className="font-medium text-primary hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-medium">{item.title}</p>
                  )}
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{formatHistoryDate(item.date)}</p>
                  {item.amountLabel ? (
                    <p className="mt-0.5 font-medium tabular-nums text-foreground">
                      {item.amountLabel}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
