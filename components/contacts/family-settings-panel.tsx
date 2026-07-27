"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getFamilySettingsAction,
  updateFamilySettingsAction,
} from "@/lib/contacts/family-management-actions"

type FamilySettingsPanelProps = {
  familyId: string
  canManage: boolean
  /** Compact layout for embedding on the contact Family card. */
  embedded?: boolean
  onSaved?: () => void | Promise<void>
}

export function FamilySettingsPanel({
  familyId,
  canManage,
  embedded = false,
  onSaved,
}: FamilySettingsPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [primaryContactId, setPrimaryContactId] = useState<string>("")
  const [members, setMembers] = useState<
    Array<{ contactId: string; fullName: string; role: string }>
  >([])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setError(null)

      const result = await getFamilySettingsAction(familyId)
      if (cancelled) return

      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }

      setName(result.settings.name)
      setPrimaryContactId(result.settings.primaryContactId || "")
      setMembers(result.settings.members)
      setLoading(false)
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [familyId])

  function handleSave() {
    setError(null)
    setSavedMessage(null)

    startTransition(async () => {
      const result = await updateFamilySettingsAction({
        familyId,
        name: name.trim(),
        primaryContactId: primaryContactId || undefined,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setSavedMessage("Household settings saved.")
      router.refresh()
      await onSaved?.()
    })
  }

  if (!canManage) {
    return null
  }

  const form = (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading settings...
        </div>
      ) : (
        <>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {savedMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {savedMessage}
            </div>
          ) : null}

          <div className={`grid gap-4 ${embedded ? "" : "md:grid-cols-2"}`}>
            <div className="space-y-2">
              <Label htmlFor="family-settings-name">Household name</Label>
              <Input
                id="family-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="family-settings-primary">Primary contact / head</Label>
              <Select
                value={primaryContactId}
                onValueChange={setPrimaryContactId}
                disabled={isPending || members.length === 0}
              >
                <SelectTrigger id="family-settings-primary">
                  <SelectValue placeholder="Select household head" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.contactId} value={member.contactId}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="rounded-md border border-border bg-muted/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Settings2 className="h-4 w-4" />
          Household settings
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Edit the household name or change who is listed as the primary contact / head. The first
          adult added is head by default.
        </p>
        {form}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          Household settings
        </CardTitle>
        <CardDescription>
          Edit the household name or change who is listed as the primary contact / head of family.
        </CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}
