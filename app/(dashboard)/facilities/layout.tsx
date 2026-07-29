import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Facilities",
}

export default function FacilitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
