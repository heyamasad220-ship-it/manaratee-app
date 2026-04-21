"use client"

import { Header } from "@/components/layout/header"
import { SignUpsTabNav } from "@/components/layout/sign-ups-tab-nav"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default function SignUpsSettingsPage() {
  return (
    <>
      <Header title="Sign-Ups" />
      <SignUpsTabNav />
      <PlaceholderPage
        title="Sign-Up Settings"
        description="Settings for sign-ups will appear here."
      />
    </>
  )
}
