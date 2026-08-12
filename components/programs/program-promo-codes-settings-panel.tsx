"use client"

import * as React from "react"
import { Loader2, Ticket } from "lucide-react"

import { ProgramPromoCodesEditor } from "@/components/programs/program-promo-codes-editor"
import { ProgramSiblingDiscountEditorWithSave } from "@/components/programs/program-sibling-discount-editor"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import { getProgramStatusLabel } from "@/lib/programs/program-status"
import type { ProgramOfferingDiscountRule } from "@/lib/programs/program-fee-plan-types"

type ProgramOption = {
  id: string
  name: string
  status: string
}

type OfferingOption = {
  id: string
  name: string
  is_default: boolean
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "default" as const
    case "draft":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function ProgramPromoCodesSettingsPanel() {
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [organizationId, setOrganizationId] = React.useState<string | null>(null)
  const [programs, setPrograms] = React.useState<ProgramOption[]>([])
  const [offerings, setOfferings] = React.useState<OfferingOption[]>([])
  const [discountRules, setDiscountRules] = React.useState<
    ProgramOfferingDiscountRule[]
  >([])
  const [loadingOfferings, setLoadingOfferings] = React.useState(false)
  const [selectedProgramId, setSelectedProgramId] = React.useState<string>("")
  const [selectedOfferingId, setSelectedOfferingId] = React.useState<string>("")

  React.useEffect(() => {
    async function loadPrograms() {
      setLoading(true)
      setError(null)

      try {
        const orgId = await getSelectedOrganizationIdClient()

        if (!orgId) {
          setError("No organization selected.")
          setPrograms([])
          return
        }

        setOrganizationId(orgId)

        const { data, error: programsError } = await supabase
          .from("programs")
          .select("id, name, status")
          .eq("organization_id", orgId)
          .neq("status", "archived")
          .order("name", { ascending: true })

        if (programsError) {
          throw programsError
        }

        const nextPrograms = (data ?? []) as ProgramOption[]
        setPrograms(nextPrograms)
        setSelectedProgramId((current) => current || nextPrograms[0]?.id || "")
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load programs."
        )
        setPrograms([])
      } finally {
        setLoading(false)
      }
    }

    void loadPrograms()
  }, [supabase])

  React.useEffect(() => {
    if (!selectedProgramId || !organizationId) {
      setOfferings([])
      setSelectedOfferingId("")
      setDiscountRules([])
      return
    }

    async function loadOfferings() {
      setLoadingOfferings(true)

      try {
        const { data, error: offeringsError } = await supabase
          .from("program_offerings")
          .select("id, name, is_default")
          .eq("organization_id", organizationId)
          .eq("program_id", selectedProgramId)
          .neq("status", "archived")
          .order("is_default", { ascending: false })
          .order("name", { ascending: true })

        if (offeringsError) {
          throw offeringsError
        }

        const nextOfferings = (data ?? []) as OfferingOption[]
        setOfferings(nextOfferings)
        setSelectedOfferingId((current) => {
          if (current && nextOfferings.some((offering) => offering.id === current)) {
            return current
          }
          return (
            nextOfferings.find((offering) => offering.is_default)?.id ??
            nextOfferings[0]?.id ??
            ""
          )
        })
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load programs."
        )
        setOfferings([])
        setSelectedOfferingId("")
      } finally {
        setLoadingOfferings(false)
      }
    }

    void loadOfferings()
  }, [organizationId, selectedProgramId, supabase])

  React.useEffect(() => {
    if (!selectedOfferingId || !organizationId) {
      setDiscountRules([])
      return
    }

    async function loadDiscountRules() {
      const { data, error: rulesError } = await supabase
        .from("program_offering_discount_rules")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("offering_id", selectedOfferingId)

      if (rulesError) {
        console.warn("Could not load discount rules:", rulesError.message)
        setDiscountRules([])
        return
      }

      setDiscountRules((data ?? []) as ProgramOfferingDiscountRule[])
    }

    void loadDiscountRules()
  }, [organizationId, selectedOfferingId, supabase])

  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId
  )
  const selectedOffering = offerings.find(
    (offering) => offering.id === selectedOfferingId
  )

  async function refreshDiscountRules() {
    if (!selectedOfferingId || !organizationId) {
      return
    }

    const { data } = await supabase
      .from("program_offering_discount_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("offering_id", selectedOfferingId)

    setDiscountRules((data ?? []) as ProgramOfferingDiscountRule[])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading programs...
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
      </Card>
    )
  }

  if (programs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Promo Codes</CardTitle>
          <CardDescription>
            Create a program first, then manage promo codes and discounts here.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="size-5" />
          Promo Codes & Discounts
        </CardTitle>
        <CardDescription>
          Manage registration promo codes and sibling discounts for each program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="promo-codes-program">Program</Label>
            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
              <SelectTrigger id="promo-codes-program">
                <SelectValue placeholder="Select a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgram ? (
              <div className="pt-1">
                <Badge variant={statusBadgeVariant(selectedProgram.status)}>
                  {getProgramStatusLabel(selectedProgram.status)}
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo-codes-offering">Program</Label>
            <Select
              value={selectedOfferingId}
              onValueChange={setSelectedOfferingId}
              disabled={loadingOfferings || offerings.length === 0}
            >
              <SelectTrigger id="promo-codes-offering">
                <SelectValue
                  placeholder={
                    loadingOfferings ? "Loading programs..." : "Select a program"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {offerings.map((offering) => (
                  <SelectItem key={offering.id} value={offering.id}>
                    {offering.name}
                    {offering.is_default ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProgram && selectedOffering && organizationId ? (
          <>
            <div className="rounded-lg border p-4">
              <ProgramSiblingDiscountEditorWithSave
                key={`${selectedProgram.id}-${selectedOffering.id}`}
                programId={selectedProgram.id}
                offeringId={selectedOffering.id}
                discountRules={discountRules}
                onSaved={() => void refreshDiscountRules()}
              />
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Promo codes</h3>
                <p className="text-xs text-muted-foreground">
                  Registration promo codes for {selectedProgram.name}.
                </p>
              </div>
              <ProgramPromoCodesEditor
                key={selectedProgram.id}
                programId={selectedProgram.id}
                organizationId={organizationId}
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
