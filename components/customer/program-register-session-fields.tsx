"use client"

import { useEffect, useMemo, useState } from "react"

import type { ProgramRegistrationOptionType } from "@/lib/programs/program-registration-option-types"

type SessionOption = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  price: number | null
  remaining: number
}

function formatDate(date?: string | null) {
  if (!date) return "TBD"
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ProgramRegisterSessionFields({
  sessions,
}: {
  sessions: SessionOption[]
}) {
  const [optionType, setOptionType] = useState<ProgramRegistrationOptionType | "">(
    ""
  )

  useEffect(() => {
    function syncOptionType() {
      const selected = document.querySelector<HTMLInputElement>(
        'input[name="registration_option_id"]:checked'
      )
      const nextType = (selected?.dataset.optionType ||
        "") as ProgramRegistrationOptionType | ""
      setOptionType(nextType)
    }

    syncOptionType()

    const inputs = document.querySelectorAll('input[name="registration_option_id"]')
    inputs.forEach((input) => {
      input.addEventListener("change", syncOptionType)
    })

    return () => {
      inputs.forEach((input) => {
        input.removeEventListener("change", syncOptionType)
      })
    }
  }, [])

  const showSessions = useMemo(
    () =>
      optionType === "selected_sessions" ||
      optionType === "single_session" ||
      optionType === "drop_in",
    [optionType]
  )

  const inputType =
    optionType === "selected_sessions" ? "checkbox" : "radio"

  if (!showSessions) {
    return null
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Sessions</label>
        <p className="text-xs text-muted-foreground">
          {optionType === "selected_sessions"
            ? "Select the sessions or weeks you want."
            : "Select exactly one session."}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          No sessions are available for this offering yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <label
              key={session.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-sm hover:bg-muted"
            >
              <span className="flex items-start gap-3">
                <input
                  type={inputType}
                  name="session_ids"
                  value={session.id}
                  required={inputType === "radio"}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{session.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(session.start_date)} – {formatDate(session.end_date)}
                  </span>
                </span>
              </span>

              <span className="text-right text-xs text-muted-foreground">
                <span className="block text-[11px] italic">
                  Final price shown at checkout
                </span>
                <span className="block text-emerald-700">
                  {session.remaining} seat{session.remaining === 1 ? "" : "s"} available
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
