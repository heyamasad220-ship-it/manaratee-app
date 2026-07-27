"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  REGISTRATION_QUESTION_TYPE_LABELS,
  createEmptyRegistrationQuestion,
  type RegistrationQuestionInput,
  type RegistrationQuestionType,
} from "@/lib/programs/program-registration-question-types"

const PRESET_PROMPTS = [
  "Photo / video consent",
  "Allergies or medical notes",
  "Emergency contact phone",
]

export function OfferingRegistrationQuestionsEditor({
  questions,
  onChange,
  disabled = false,
}: {
  questions: RegistrationQuestionInput[]
  onChange: (questions: RegistrationQuestionInput[]) => void
  disabled?: boolean
}) {
  function updateQuestion(
    clientId: string,
    patch: Partial<RegistrationQuestionInput>
  ) {
    onChange(
      questions.map((question) =>
        question.clientId === clientId ? { ...question, ...patch } : question
      )
    )
  }

  function removeQuestion(clientId: string) {
    onChange(questions.filter((question) => question.clientId !== clientId))
  }

  function addQuestion(prompt = "") {
    onChange([...questions, createEmptyRegistrationQuestion(prompt)])
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Ask families for photo consent, allergies, or any custom information
        during registration. Mark each question optional or required.
      </p>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          No questions yet. Add one below.
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((question, index) => (
            <li
              key={question.clientId}
              className="space-y-3 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Label className="text-xs text-muted-foreground">
                  Question {index + 1}
                </Label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() => removeQuestion(question.clientId)}
                  aria-label="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Prompt</Label>
                <Input
                  value={question.prompt}
                  disabled={disabled}
                  placeholder="e.g. Photo / video consent"
                  onChange={(event) =>
                    updateQuestion(question.clientId, {
                      prompt: event.target.value,
                    })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Answer type</Label>
                  <select
                    value={question.questionType}
                    disabled={disabled}
                    onChange={(event) =>
                      updateQuestion(question.clientId, {
                        questionType: event.target
                          .value as RegistrationQuestionType,
                      })
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
                <label className="flex h-9 items-center gap-2 text-sm">
                  <Checkbox
                    checked={question.required}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateQuestion(question.clientId, {
                        required: checked === true,
                      })
                    }
                  />
                  Required
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => addQuestion()}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add question
        </Button>
        {PRESET_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => addQuestion(prompt)}
          >
            + {prompt}
          </Button>
        ))}
      </div>
    </div>
  )
}
