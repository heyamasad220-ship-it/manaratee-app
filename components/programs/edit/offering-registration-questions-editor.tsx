"use client"

import * as React from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ALL_REGISTRATION_QUESTION_TYPE_LABELS,
  REGISTRATION_QUESTION_TYPE_LABELS,
  createEmptyRegistrationQuestion,
  formatOptionsAsCsv,
  parseOptionsFromCsv,
  type RegistrationQuestionInput,
  type RegistrationQuestionType,
} from "@/lib/programs/program-registration-question-types"

type DialogDraft = {
  clientId: string | null
  prompt: string
  questionType: Exclude<RegistrationQuestionType, "yes_no">
  required: boolean
  optionsCsv: string
}

const EMPTY_DRAFT: DialogDraft = {
  clientId: null,
  prompt: "",
  questionType: "text",
  required: false,
  optionsCsv: "",
}

function toDialogType(
  type: RegistrationQuestionType
): Exclude<RegistrationQuestionType, "yes_no"> {
  if (type === "textarea" || type === "select" || type === "text") return type
  return "text"
}

export function OfferingRegistrationQuestionsEditor({
  questions,
  onChange,
  disabled = false,
}: {
  questions: RegistrationQuestionInput[]
  onChange: (questions: RegistrationQuestionInput[]) => void
  disabled?: boolean
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DialogDraft>(EMPTY_DRAFT)
  const [dialogError, setDialogError] = React.useState<string | null>(null)

  function openAddDialog() {
    setDraft(EMPTY_DRAFT)
    setDialogError(null)
    setDialogOpen(true)
  }

  function openEditDialog(question: RegistrationQuestionInput) {
    setDraft({
      clientId: question.clientId,
      prompt: question.prompt,
      questionType: toDialogType(question.questionType),
      required: question.required,
      optionsCsv: formatOptionsAsCsv(question.options || []),
    })
    setDialogError(null)
    setDialogOpen(true)
  }

  function removeQuestion(clientId: string) {
    onChange(questions.filter((question) => question.clientId !== clientId))
  }

  function saveDialog() {
    const prompt = draft.prompt.trim()
    if (!prompt) {
      setDialogError("Question is required.")
      return
    }

    const options =
      draft.questionType === "select" ? parseOptionsFromCsv(draft.optionsCsv) : []
    if (draft.questionType === "select" && options.length === 0) {
      setDialogError("Enter at least one drop-down value.")
      return
    }

    const nextQuestion: RegistrationQuestionInput = {
      clientId: draft.clientId || createEmptyRegistrationQuestion().clientId,
      id: questions.find((row) => row.clientId === draft.clientId)?.id,
      prompt,
      questionType: draft.questionType,
      required: draft.required,
      options,
    }

    if (draft.clientId) {
      onChange(
        questions.map((question) =>
          question.clientId === draft.clientId ? nextQuestion : question
        )
      )
    } else {
      onChange([...questions, nextQuestion])
    }

    setDialogOpen(false)
    setDraft(EMPTY_DRAFT)
    setDialogError(null)
  }

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          No questions yet. Add one below.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {questions.map((question) => (
            <li
              key={question.clientId}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{question.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  {
                    ALL_REGISTRATION_QUESTION_TYPE_LABELS[
                      question.questionType
                    ]
                  }
                  {question.required ? " · Required" : " · Optional"}
                  {question.questionType === "select" &&
                  question.options.length > 0
                    ? ` · ${question.options.length} options`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => openEditDialog(question)}
                  aria-label="Edit question"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() => removeQuestion(question.clientId)}
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={openAddDialog}
      >
        <Plus className="mr-1 h-4 w-4" />
        Add question
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft.clientId ? "Edit question" : "Add question"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="registration-question-prompt">Question</Label>
              <Input
                id="registration-question-prompt"
                value={draft.prompt}
                disabled={disabled}
                placeholder="e.g. How did you hear about us?"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registration-question-type">Answer type</Label>
              <select
                id="registration-question-type"
                value={draft.questionType}
                disabled={disabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    questionType: event.target
                      .value as Exclude<RegistrationQuestionType, "yes_no">,
                  }))
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
              >
                {Object.entries(REGISTRATION_QUESTION_TYPE_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            {draft.questionType === "select" ? (
              <div className="space-y-1.5">
                <Label htmlFor="registration-question-options">
                  Drop-down values
                </Label>
                <Input
                  id="registration-question-options"
                  value={draft.optionsCsv}
                  disabled={disabled}
                  placeholder="Option A, Option B, Option C"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      optionsCsv: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Separate values with commas.
                </p>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.required}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    required: checked === true,
                  }))
                }
              />
              Required
            </label>

            {dialogError ? (
              <p className="text-sm text-destructive">{dialogError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={disabled} onClick={saveDialog}>
              {draft.clientId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
