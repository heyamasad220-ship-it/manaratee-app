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
import {
  DIRECTORY_FAMILIES_PATH,
  DIRECTORY_ORGANIZATIONS_PATH,
  DIRECTORY_PEOPLE_PATH,
} from "@/lib/directory/directory-paths"

const ADD_ITEMS = [
  { label: "Person", href: `${DIRECTORY_PEOPLE_PATH}?add=1` },
  { label: "Organization", href: `${DIRECTORY_ORGANIZATIONS_PATH}?add=1` },
  { label: "Family", href: `${DIRECTORY_FAMILIES_PATH}?add=1` },
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
