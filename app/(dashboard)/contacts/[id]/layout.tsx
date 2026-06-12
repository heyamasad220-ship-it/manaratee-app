import { ContactPortalSupportActions } from "@/components/organizations/contact-portal-support-actions"

type ContactDetailLayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ContactDetailLayout({
  children,
  params,
}: ContactDetailLayoutProps) {
  const { id } = await params

  return (
    <>
      <ContactPortalSupportActions contactId={id} />
      {children}
    </>
  )
}
