import { formatPhoneDisplay } from "@/lib/ui/format-phone"

export function PhoneText({
  value,
  empty = "—",
}: {
  value?: string | null
  empty?: string
}) {
  return <>{formatPhoneDisplay(value) || empty}</>
}
