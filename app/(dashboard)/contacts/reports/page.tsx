import Link from "next/link"
import { ArrowRight, FileSpreadsheet, Gift } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CONTACTS_MODULE_LABEL } from "@/lib/contacts/contact-module-label"

export default function ContactsReportsPage() {
  return (
    <>
      <Header title={`${CONTACTS_MODULE_LABEL} Reports`} />
      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">
          Export and analyze your contact directory. For donor giving totals, pledges, and receipts,
          use Donations → Reports → Donors.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-3">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Contact Directory</CardTitle>
                  <CardDescription>
                    Filter by record type, role, status, team, or search — then export CSV.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/contacts/reports/directory">
                  Open directory report
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-3">
                  <Gift className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Donor giving</CardTitle>
                  <CardDescription>
                    Lifetime gifts, open pledges, and lapsed donors live under Donations reports.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/donations/reports/donors">Go to Donors report</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
