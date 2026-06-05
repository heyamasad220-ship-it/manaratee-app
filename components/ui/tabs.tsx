'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-auto w-fit flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-600 transition-colors',
        'hover:bg-amber-50/70 hover:text-amber-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/20 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 data-[state=active]:shadow-none',
        'dark:text-zinc-400 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 dark:data-[state=active]:bg-amber-950/40 dark:data-[state=active]:text-amber-400',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'flex-1 outline-none data-[state=inactive]:hidden',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
