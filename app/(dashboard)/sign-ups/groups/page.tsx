"use client"

import { Header } from "@/components/layout/header"
import { SignUpsTabNav } from "@/components/layout/sign-ups-tab-nav"
import { GroupsTable } from "@/components/sign-ups/groups/groups-table"

export default function SignUpsGroupsPage() {
  return (
    <>
      <Header title="Groups" />
      <SignUpsTabNav />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <GroupsTable />
      </div>
    </>
  )
}
