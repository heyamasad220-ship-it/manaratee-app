"use client"

import { AFFILIATION_RULE_DEFINITIONS } from "@/lib/contacts/contact-affiliation-rules"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function AffiliationRulesPanel() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Automatic affiliations</CardTitle>
          <CardDescription>
            Affiliations are derived from activity across modules. Staff can still add or remove
            labels on a contact profile — manual overrides are preserved during sync except where
            noted below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliation</TableHead>
                <TableHead>Triggered by</TableHead>
                <TableHead>Auto-add</TableHead>
                <TableHead>Auto-remove</TableHead>
                <TableHead>Module list</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AFFILIATION_RULE_DEFINITIONS.map((rule) => (
                <TableRow key={rule.role}>
                  <TableCell className="font-medium">{rule.label}</TableCell>
                  <TableCell className="text-muted-foreground">{rule.trigger}</TableCell>
                  <TableCell>{rule.autoAdd}</TableCell>
                  <TableCell>
                    {rule.autoRemove.startsWith("Never") ? (
                      <Badge variant="secondary">{rule.autoRemove}</Badge>
                    ) : (
                      rule.autoRemove
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{rule.moduleList}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Organization contacts follow the same donor rules as individuals — once they give, the
            donor affiliation stays. Other affiliations (customer, service provider) are managed
            manually on the contact profile.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
