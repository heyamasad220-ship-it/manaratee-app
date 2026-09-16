"use client"

import Link from "next/link"
import { GraduationCap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

export function ContactProgramWorkspacePanel({
  programs,
}: {
  programs: Array<{ programId: string; programName: string }>
}) {
  if (programs.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          Program workspace
        </CardTitle>
        <CardDescription>
          Open the year or season this person leads. They see every offering in
          that program — not the whole department.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {programs.map((program) => (
          <div
            key={program.programId}
            className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{program.programName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Program Lead</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={programWorkspaceHref(program.programId, {
                  tab: "offerings",
                })}
              >
                Open workspace
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
