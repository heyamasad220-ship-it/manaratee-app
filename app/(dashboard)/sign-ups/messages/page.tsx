"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessagesTable } from "@/components/sign-ups/messages/messages-table"
import { ComposeMessageModal } from "@/components/sign-ups/messages/compose-message-modal"

export default function SignUpsMessagesPage() {
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <>
      <Header title="Messages" />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* Top actions row */}
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Select defaultValue="all">
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Search for" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Search for</SelectItem>
                <SelectItem value="subject">Subject</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-1.5" onClick={() => setComposeOpen(true)}>
            <Plus className="h-4 w-4" />
            Compose
          </Button>
        </div>

        <MessagesTable />
      </div>

      <ComposeMessageModal open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  )
}
