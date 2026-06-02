import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const message = params?.error

  const isInviteIssue =
    message?.toLowerCase().includes("already") ||
    message?.toLowerCase().includes("expired") ||
    message?.toLowerCase().includes("invalid") ||
    message?.toLowerCase().includes("pkce")

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sorry, something went wrong.</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                An unspecified error occurred while signing you in.
              </p>
            )}

            {isInviteIssue && (
              <p className="text-sm text-muted-foreground">
                If you were invited to Manaratee, do not use Sign up on the login page.
                Open the invitation email and click the link there, or ask your administrator
                to send a new invite.
              </p>
            )}

            <Button asChild className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
