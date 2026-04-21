"use client"

import { UserMenu } from "@/components/layout/user-menu"
import { MobileMenuTrigger } from "@/components/layout/sidebar"
import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface HeaderProps {
  title: string
  showSearch?: boolean
}

export function Header({ title, showSearch = false }: HeaderProps) {
  return (
    <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <MobileMenuTrigger />
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-3">
        {showSearch && (
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="w-[200px] lg:w-[280px] pl-9 h-9"
            />
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
