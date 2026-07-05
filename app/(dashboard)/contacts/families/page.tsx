import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchFamilyListSummaries } from "@/lib/contacts/family-giving-data"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function ContactsFamiliesPage() {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  const familiesResult = organizationId
    ? await fetchFamilyListSummaries(supabase, organizationId)
    : { ok: false as const, error: "No organization selected." }

  const households = familiesResult.ok ? familiesResult.families : []
  const loadError = familiesResult.ok ? null : familiesResult.error

  return (
    <>
      <Header title="Families" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Household groupings with computed giving totals. Donations always belong to individual
            contacts; family pages aggregate member gifts without duplicating ownership.
          </p>
        </div>

        {loadError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {loadError}
          </div>
        ) : null}

        <Card>
          <CardContent className="p-0">
            {households.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No family households yet. Relationships are created when members add family in the
                member portal or when staff link dependents on a person profile.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead>Primary contact</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Lifetime giving</TableHead>
                    <TableHead>Gifts</TableHead>
                    <TableHead>Last gift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {households.map((household) => (
                    <TableRow key={household.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/contacts/families/${household.id}`}
                          className="text-primary hover:underline"
                        >
                          {household.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>{household.primaryName || "—"}</div>
                        {household.primaryEmail ? (
                          <div className="text-xs text-muted-foreground">
                            {household.primaryEmail}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{household.memberCount}</TableCell>
                      <TableCell>{formatCurrency(household.lifetimeTotal)}</TableCell>
                      <TableCell>{household.giftCount}</TableCell>
                      <TableCell>{formatDate(household.lastGiftDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
