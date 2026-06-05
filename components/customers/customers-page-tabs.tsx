"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CustomerList } from "@/components/customers/customer-list"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export function CustomersPageTabs() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <Tabs defaultValue="all-customers" className="flex flex-1 flex-col">
      <div className="border-b border-border px-6">
        <TabsList className="h-10 w-fit rounded-none border-0 bg-transparent p-0">
          <TabsTrigger
            value="all-customers"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-amber-600 data-[state=active]:bg-transparent data-[state=active]:text-amber-700 data-[state=active]:shadow-none"
          >
            All People
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-amber-600 data-[state=active]:bg-transparent data-[state=active]:text-amber-700 data-[state=active]:shadow-none"
          >
            Reports
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-amber-600 data-[state=active]:bg-transparent data-[state=active]:text-amber-700 data-[state=active]:shadow-none"
          >
            Settings
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="all-customers" className="flex-1 mt-0">
        <CustomerList />
      </TabsContent>

      <TabsContent value="reports" className="flex-1 mt-0">
        <PlaceholderPage
          title="Reports"
          description="People analytics and reports. Coming soon."
        />
      </TabsContent>

      <TabsContent value="settings" className="flex-1 mt-0">
        <PlaceholderPage
          title="Settings"
          description="People module settings and configuration. Coming soon."
        />
      </TabsContent>
    </Tabs>
  )
}
