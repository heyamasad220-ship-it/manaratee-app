import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { MEMBERSHIP_MODULE_LABEL } from "@/lib/memberships/membership-module-label"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"

type ContactsIntroCopyProps = {
  variant?: "all" | "people" | "organizations"
}

export function ContactsIntroCopy({ variant = "all" }: ContactsIntroCopyProps) {
  const lead =
    variant === "people"
      ? "People are individuals in your community — families, donors, and program participants."
      : variant === "organizations"
        ? "Organizations are external entities you work with — vendors, partner orgs, and venue renters."
        : "Contacts is your community identity layer — people, families, and external organizations."

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 text-sm text-muted-foreground">
        <p>{lead}</p>
        <p className="mt-2">
          MAS membership, teams, and benefits live under{" "}
          <Link href="/membership" className="font-medium text-primary hover:underline">
            {MEMBERSHIP_MODULE_LABEL}
          </Link>
          . Employees, volunteers, and childcare providers are managed in{" "}
          <Link href="/workforce" className="font-medium text-primary hover:underline">
            {WORKFORCE_MODULE_LABEL}
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
