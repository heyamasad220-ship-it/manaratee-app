"use client"

import * as React from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Underline from "@tiptap/extension-underline"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import {
  isRichTextEmpty,
  plainTextToHtml,
  sanitizeRichTextHtml,
} from "@/lib/ui/rich-text"
import { cn } from "@/lib/utils"

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Black", value: "#0f172a" },
  { label: "Gray", value: "#64748b" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
] as const

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minHeightClassName?: string
}

function ToolbarButton({
  pressed,
  onPressedChange,
  disabled,
  label,
  children,
}: {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <Toggle
      size="sm"
      pressed={Boolean(pressed)}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-8 w-8 p-0"
    >
      {children}
    </Toggle>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write a description…",
  disabled = false,
  className,
  minHeightClassName = "min-h-[180px]",
}: RichTextEditorProps) {
  const lastEmitted = React.useRef(sanitizeRichTextHtml(plainTextToHtml(value)))

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
    ],
    content: plainTextToHtml(value) || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none px-3 py-2 focus:outline-none",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_p]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold",
          minHeightClassName
        ),
        dir: "auto",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: next }) => {
      const html = sanitizeRichTextHtml(next.getHTML())
      const normalized = isRichTextEmpty(html) ? "" : html
      lastEmitted.current = normalized
      onChange(normalized)
    },
  })

  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  React.useEffect(() => {
    if (!editor) return
    const nextHtml = sanitizeRichTextHtml(plainTextToHtml(value))
    const normalized = isRichTextEmpty(nextHtml) ? "" : nextHtml
    if (normalized === lastEmitted.current) return
    lastEmitted.current = normalized
    editor.commands.setContent(normalized || "", { emitUpdate: false })
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground",
          minHeightClassName,
          className
        )}
      >
        Loading editor…
      </div>
    )
  }

  return (
    <div className={cn("overflow-hidden rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1.5">
        <ToolbarButton
          label="Bold"
          pressed={editor.isActive("bold")}
          disabled={disabled}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          pressed={editor.isActive("italic")}
          disabled={disabled}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          pressed={editor.isActive("underline")}
          disabled={disabled}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          label="Align left"
          pressed={editor.isActive({ textAlign: "left" })}
          disabled={disabled}
          onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          pressed={editor.isActive({ textAlign: "center" })}
          disabled={disabled}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("center").run()
          }
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          pressed={editor.isActive({ textAlign: "right" })}
          disabled={disabled}
          onPressedChange={() =>
            editor.chain().focus().setTextAlign("right").run()
          }
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          label="Bullet list"
          pressed={editor.isActive("bulletList")}
          disabled={disabled}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          pressed={editor.isActive("orderedList")}
          disabled={disabled}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <label className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          Color
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
            disabled={disabled}
            value={editor.getAttributes("textStyle").color || ""}
            onChange={(event) => {
              const next = event.target.value
              if (!next) {
                editor.chain().focus().unsetColor().run()
                return
              }
              editor.chain().focus().setColor(next).run()
            }}
          >
            {TEXT_COLORS.map((color) => (
              <option key={color.label} value={color.value}>
                {color.label}
              </option>
            ))}
          </select>
        </label>

        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-8 text-xs"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}

type RichTextDisplayProps = {
  html: string | null | undefined
  emptyLabel?: string
  className?: string
}

/** Read-only sanitized rich text. */
export function RichTextDisplay({
  html,
  emptyLabel = "No description yet.",
  className,
}: RichTextDisplayProps) {
  const sanitized = sanitizeRichTextHtml(plainTextToHtml(html))
  if (isRichTextEmpty(sanitized)) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>
    )
  }

  return (
    <div
      dir="auto"
      className={cn(
        "prose prose-sm max-w-none text-sm",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_p]:my-1",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
