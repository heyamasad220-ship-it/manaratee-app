"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Organization = {
  id: string
  name: string
}

type OrganizationSwitcherProps = {
  organizations: Organization[]
  selectedOrganizationId?: string | null
}

export function OrganizationSwitcher({
  organizations,
  selectedOrganizationId,
}: OrganizationSwitcherProps) {
  const router = useRouter()
  const [value, setValue] = useState(selectedOrganizationId || "")

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOrgId = e.target.value
    setValue(newOrgId)

    const response = await fetch("/api/organizations/select", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: newOrgId,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      alert(result.error || "Failed to switch organization")
      return
    }

    router.refresh()
  }

  if (!organizations.length) {
    return <div className="text-sm text-muted-foreground">No organizations</div>
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="rounded-md border px-3 py-2 text-sm"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  )
}