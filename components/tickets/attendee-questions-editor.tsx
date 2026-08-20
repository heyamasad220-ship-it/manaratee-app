"use client"

import { useMemo, useState } from "react"
import {
  AlignLeft,
  Baby,
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
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  buildYouthAttendeeQuestionPack,
  type AttendeeQuestion,
  type TicketTypeOptionForQuestions,
} from "@/lib/tickets/ticketing-checkout-ui-types"

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
  ticketTypes?: TicketTypeOptionForQuestions[]
}

export function AttendeeQuestionsEditor({
  questions,
  onChange,
  ticketTypes = [],
}: AttendeeQuestionsEditorProps) {
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [showYouthPack, setShowYouthPack] = useState(false)
  const [youthTicketTypeIds, setYouthTicketTypeIds] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState<Partial<AttendeeQuestion>>({
    question: "",
    type: "text",
    required: true,
    perAttendee: true,
    options: [],
    ticketTypeIds: [],
  })
  const [newOptionText, setNewOptionText] = useState("")

  const ticketTypeNameById = useMemo(() => {
    return new Map(ticketTypes.map((type) => [type.id, type.name]))
  }, [ticketTypes])

  function deleteQuestion(questionId: string) {
    onChange(questions.filter((question) => question.id !== questionId))
  }

  function toggleTicketType(ticketTypeId: string, selected: string[]) {
    if (selected.includes(ticketTypeId)) {
      return selected.filter((id) => id !== ticketTypeId)
    }
    return [...selected, ticketTypeId]
  }

  function appliesLabel(ticketTypeIds: string[]) {
    if (!ticketTypeIds || ticketTypeIds.length === 0) {
      return "All ticket types"
    }
    const names = ticketTypeIds
      .map((id) => ticketTypeNameById.get(id) || "Ticket")
      .filter(Boolean)
    if (names.length === 0) return "Selected ticket types"
    if (names.length <= 2) return names.join(", ")
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
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
      ticketTypeIds: Array.isArray(newQuestion.ticketTypeIds)
        ? newQuestion.ticketTypeIds
        : [],
    }

    onChange([...questions, question])
    setNewQuestion({
      question: "",
      type: "text",
      required: true,
      perAttendee: true,
      options: [],
      ticketTypeIds: [],
    })
    setShowAddQuestion(false)
  }

  function addYouthPack() {
    if (youthTicketTypeIds.length === 0) return
    const pack = buildYouthAttendeeQuestionPack(youthTicketTypeIds)
    onChange([...questions, ...pack])
    setYouthTicketTypeIds([])
    setShowYouthPack(false)
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Attendee questions</h4>
          <p className="text-sm text-muted-foreground">
            Ask per ticket type at checkout (e.g. kids tickets only). Empty “applies to”
            means all ticket types.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ticketTypes.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setYouthTicketTypeIds([])
                setShowYouthPack(true)
              }}
            >
              <Baby className="mr-2 h-4 w-4" />
              Add youth question pack
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => setShowAddQuestion(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No custom questions yet. Use the youth pack for kids tickets, or add your own.
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{question.question}</span>
                    {question.required ? (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
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
                    <Badge variant="outline" className="text-xs">
                      {appliesLabel(question.ticketTypeIds || [])}
                    </Badge>
                    {question.options && question.options.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {question.options.length} options
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
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
              Choose which ticket types this question applies to at checkout.
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
                placeholder="e.g., Child's age"
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

            {ticketTypes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Applies to ticket types</Label>
                <p className="text-xs text-muted-foreground">
                  Leave all unchecked to ask for every ticket type.
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {ticketTypes.map((type) => {
                    const checked = (newQuestion.ticketTypeIds || []).includes(type.id)
                    return (
                      <label
                        key={type.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setNewQuestion({
                              ...newQuestion,
                              ticketTypeIds: toggleTicketType(
                                type.id,
                                newQuestion.ticketTypeIds || []
                              ),
                            })
                          }
                        />
                        <span>{type.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Save ticket types first to target specific tickets. Until then, questions apply
                to all types.
              </p>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="question-required">Required</Label>
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
                  On = once for each ticket of the selected type(s)
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

      <Dialog open={showYouthPack} onOpenChange={setShowYouthPack}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Youth question pack</DialogTitle>
            <DialogDescription>
              Adds age, grade, emergency contact, allergies, and photo consent — all required
              and per attendee — for the kids ticket types you select.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
            {ticketTypes.map((type) => {
              const checked = youthTicketTypeIds.includes(type.id)
              return (
                <label
                  key={type.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() =>
                      setYouthTicketTypeIds((current) =>
                        toggleTicketType(type.id, current)
                      )
                    }
                  />
                  <span>{type.name}</span>
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowYouthPack(false)}>
              Cancel
            </Button>
            <Button
              onClick={addYouthPack}
              disabled={youthTicketTypeIds.length === 0}
            >
              Add pack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
