"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessagesTable } from "@/components/sign-ups/messages/messages-table"
import { ComposeMessageModal } from "@/components/sign-ups/messages/compose-message-modal"
import { cn } from "@/lib/utils"

const reportsTabs = ["Reports", "Messages"] as const
type ReportsTab = (typeof reportsTabs)[number]

export default function SignUpsReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Reports")
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <>
      <Header title="Reports" />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {reportsTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === "Messages" && (
            <Button onClick={() => setComposeOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Compose
            </Button>
          )}
        </div>

        {/* Reports Tab */}
        {activeTab === "Reports" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volunteer Summary</CardTitle>
                <CardDescription>Overview of volunteer participation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Volunteers</span>
                    <span className="font-medium">156</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active This Month</span>
                    <span className="font-medium">89</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours Contributed</span>
                    <span className="font-medium">1,245</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event Participation</CardTitle>
                <CardDescription>Sign-up rates by event</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Events This Month</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. Fill Rate</span>
                    <span className="font-medium">78%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sign-ups</span>
                    <span className="font-medium">342</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group Performance</CardTitle>
                <CardDescription>Contribution by volunteer groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Groups</span>
                    <span className="font-medium">8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Top Group</span>
                    <span className="font-medium">Youth Council</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Members</span>
                    <span className="font-medium">23</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === "Messages" && <MessagesTable />}
      </div>

      <ComposeMessageModal open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  )
}
