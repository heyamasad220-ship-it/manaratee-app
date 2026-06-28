import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type OrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-types"
import { CreditCard, Layers, Mail, Package } from "lucide-react"

export function SubscriptionSettingsClient({
  summary,
  title = "Billing",
}: {
  summary: OrganizationSubscriptionSummary
  title?: string
}) {
  return (
    <>
      <Header title={title} />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Plan &amp; billing</h2>
            <p className="text-sm text-muted-foreground">
              Your organization&apos;s subscription plan, pricing, and enabled modules for{" "}
              {summary.organizationName}.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="mailto:support@manaratee.com?subject=Subscription%20change%20request">
              <Mail className="mr-2 h-4 w-4" />
              Request plan change
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Current plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.plan?.name ?? "No plan assigned"}</p>
              {summary.plan?.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{summary.plan.description}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bundle price
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.billingLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                Persona bundle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.bundleName ?? "Custom mix"}</p>
              {summary.bundleDescription ? (
                <p className="mt-2 text-sm text-muted-foreground">{summary.bundleDescription}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Modules were configured individually for your organization.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {(summary.plan?.memberLimit != null || summary.plan?.eventLimit != null) && (
          <Card>
            <CardHeader>
              <CardTitle>Plan limits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              {summary.plan?.memberLimit != null ? (
                <div>
                  <p className="text-muted-foreground">Member limit</p>
                  <p className="font-medium">{summary.plan.memberLimit.toLocaleString()}</p>
                </div>
              ) : null}
              {summary.plan?.eventLimit != null ? (
                <div>
                  <p className="text-muted-foreground">Event limit</p>
                  <p className="font-medium">{summary.plan.eventLimit.toLocaleString()}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Enabled product modules
            </CardTitle>
            <CardDescription>
              Billable modules included in your plan bundle. Pricing is set at the plan level, not
              per module.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.productModules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No product modules are enabled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.productModules.map((module) => (
                    <TableRow key={module.slug}>
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {module.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {module.enabledByPlan
                            ? "Included in plan"
                            : module.manuallyOverridden
                              ? "Platform add-on"
                              : "Enabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {summary.capabilityModules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Included capabilities</CardTitle>
              <CardDescription>
                Supporting features automatically enabled with your product modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.capabilityModules.map((module) => (
                  <Badge key={module.slug} variant="outline">
                    {module.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Always included</CardTitle>
            <CardDescription>Core platform modules included with every organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.coreModules.map((module) => (
                <Badge key={module.slug} variant="secondary">
                  {module.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Billing and plan changes are managed by Manaratee platform administrators. Use the button
          above to request a plan update.
        </p>
      </div>
    </>
  )
}
