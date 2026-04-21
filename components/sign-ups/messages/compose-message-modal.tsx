"use client"

import { useState } from "react"
import { X, Sparkles, Save, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface ComposeMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComposeMessageModal({ open, onOpenChange }: ComposeMessageModalProps) {
  const [sendTo, setSendTo] = useState("invite")
  const [remindOption, setRemindOption] = useState("participants")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Compose Message</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* Send To */}
          <div className="flex flex-col gap-1.5">
            <Label>Send To</Label>
            <Select value={sendTo} onValueChange={setSendTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invite">Invite to Sign-Up</SelectItem>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="group">Specific Group</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remind Option */}
          <RadioGroup value={remindOption} onValueChange={setRemindOption} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="participants" id="remind-participants" />
              <Label htmlFor="remind-participants" className="font-normal">
                Remind to Sign-Up Participants
              </Label>
            </div>
          </RadioGroup>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <Input
              placeholder="Enter subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <Textarea
              placeholder="Hi [First Name],

We're looking for volunteers for the upcoming event. Click the link below to sign-up."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Insert Variable
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-primary">
              <Save className="h-3.5 w-3.5" />
              Save Templates
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-primary">
              <Link2 className="h-3.5 w-3.5" />
              Link
            </Button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button>
              Send Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
