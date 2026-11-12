"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { directoryContactsTabPath } from "@/lib/directory/directory-paths"

const ADD_ITEMS = [
  { label: "Person", href: `${directoryContactsTabPath("people")}&add=1` },
  { label: "Organization", href: `${directoryContactsTabPath("organizations")}&add=1` },
  { label: "Family", href: `${directoryContactsTabPath("families")}&add=1` },
] as const

export function DirectoryAddMenu({
  align = "end",
}: {
  align?: "start" | "center" | "end"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44">
        {ADD_ITEMS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
