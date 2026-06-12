"use client"

import { useState } from "react"
import {
  AlignLeft,
  ClipboardList,
  GripVertical,
  Hash,
  ListChecks,
  Plus,
  ToggleLeft,
  Trash2,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AttendeeQuestion } from "@/lib/tickets/ticketing-checkout-ui-types"

const fieldIcons: Record<string, LucideIcon> = {
  text: User,
  textarea: AlignLeft,
  select: ListChecks,
  checkbox: ToggleLeft,
  number: Hash,
}

type AttendeeQuestionsEditorProps = {
  questions: AttendeeQuestion[]
  onChange: (questions: AttendeeQuestion[]) => void
}

export function AttendeeQuestionsEditor({
  questions,
  onChange,
}: AttendeeQuestionsEditorProps) {
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQuestion, setNewQuestion] = useState<Partial<AttendeeQuestion>>({
    question: "",
    type: "text",
    required: false,
    perAttendee: true,
    options: [],
  })
  const [newOptionText, setNewOptionText] = useState("")

  function deleteQuestion(questionId: string) {
    onChange(questions.filter((question) => question.id !== questionId))
  }

  function addQuestion() {
    if (!newQuestion.question?.trim()) return

    const question: AttendeeQuestion = {
      id: `aq-${Date.now()}`,
      question: newQuestion.question.trim(),
      type: newQuestion.type || "text",
      required: newQuestion.required || false,
      perAttendee: newQuestion.perAttendee ?? true,
      options: newQuestion.options,
    }

    onChange([...questions, question])
    setNewQuestion({
      question: "",
      type: "text",
      required: false,
      perAttendee: true,
      options: [],
    })
    setShowAddQuestion(false)
  }

  function addOption() {
    if (!newOptionText.trim()) return
    setNewQuestion({
      ...newQuestion,
      options: [...(newQuestion.options || []), newOptionText.trim()],
    })
    setNewOptionText("")
  }

  function removeOption(index: number) {
    setNewQuestion({
      ...newQuestion,
      options: (newQuestion.options || []).filter((_, i) => i !== index),
    })
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Attendee questions</h4>
          <p className="text-sm text-muted-foreground">
            Collect event-specific information during checkout.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddQuestion(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No custom questions yet. Add questions like t-shirt size or meal preference.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((question) => {
            const QuestionIcon = fieldIcons[question.type] || User

            return (
              <div
                key={question.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100">
                  <QuestionIcon className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{question.question}</span>
                    {question.required ? (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs capitalize text-muted-foreground">
                      {question.type}
                    </span>
                    {question.perAttendee ? (
                      <Badge variant="outline" className="text-xs">
                        Per attendee
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-xs text-blue-700">
                        Per order
                      </Badge>
                    )}
                    {question.options && question.options.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {question.options.length} options
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteQuestion(question.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add attendee question</DialogTitle>
            <DialogDescription>
              Shown during checkout for this event only.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="question-text">Question</Label>
              <Input
                id="question-text"
                value={newQuestion.question || ""}
                onChange={(event) =>
                  setNewQuestion({ ...newQuestion, question: event.target.value })
                }
                placeholder="e.g., T-shirt size"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="question-type">Answer type</Label>
              <Select
                value={newQuestion.type}
                onValueChange={(value) =>
                  setNewQuestion({
                    ...newQuestion,
                    type: value as AttendeeQuestion["type"],
                  })
                }
              >
                <SelectTrigger id="question-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short text</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Yes / No</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newQuestion.type === "select" ? (
              <div className="flex flex-col gap-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOptionText}
                    onChange={(event) => setNewOptionText(event.target.value)}
                    placeholder="Add option"
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    Add
                  </Button>
                </div>
                {(newQuestion.options || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(newQuestion.options || []).map((option, index) => (
                      <Badge key={option} variant="secondary" className="gap-1">
                        {option}
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => removeOption(index)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="question-required">Required</Label>
              </div>
              <Switch
                id="question-required"
                checked={newQuestion.required}
                onCheckedChange={(checked) =>
                  setNewQuestion({ ...newQuestion, required: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="question-per-attendee">Ask per attendee</Label>
                <p className="text-xs text-muted-foreground">
                  Off = one answer for the whole order
                </p>
              </div>
              <Switch
                id="question-per-attendee"
                checked={newQuestion.perAttendee ?? true}
                onCheckedChange={(checked) =>
                  setNewQuestion({ ...newQuestion, perAttendee: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddQuestion(false)}>
              Cancel
            </Button>
            <Button onClick={addQuestion}>Add question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
