import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchFamilyHouseholdSummaries } from "@/lib/contacts/family-queries"

function formatRelationships(values: string[]) {
  if (values.length === 0) return "—"
  return values
    .map((value) =>
      value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(", ")
}

export default async function ContactsFamiliesPage() {
  const households = await fetchFamilyHouseholdSummaries()

  return (
    <>
      <Header title="Families" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Families</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Household groupings linked through person relationships. Family members share
            contacts and program registrations — they are not separate workforce records.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            {households.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No family households yet. Relationships are created when members add family
                in the member portal or when staff link dependents on a person profile.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Primary contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Family members</TableHead>
                    <TableHead>Relationships</TableHead>
                    <TableHead className="text-right">Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {households.map((household) => (
                    <TableRow key={household.id}>
                      <TableCell className="font-medium">
                        {household.primaryName}
                      </TableCell>
                      <TableCell>{household.primaryEmail || "—"}</TableCell>
                      <TableCell>{household.memberCount}</TableCell>
                      <TableCell>
                        {formatRelationships(household.relationshipTypes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {household.primaryContactId ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/contacts/${household.primaryContactId}`}>
                              Open profile
                            </Link>
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
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
