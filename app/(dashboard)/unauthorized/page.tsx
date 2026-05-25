import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function UnauthorizedPage() {
  return (
    <>
      <Header title="Unauthorized" />

      <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You do not have permission to view this page. Contact your administrator if you believe this is a mistake.
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
