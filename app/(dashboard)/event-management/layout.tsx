import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Event Management",
}

export default function EventManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
