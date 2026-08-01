import { ContactFinancialPanel } from "@/components/contacts/contact-financial-panel"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"

const EMPTY_MODULES: ContactProfileModuleFlags = {
  donations: false,
  bookings: false,
  workforce: false,
  vendorHub: false,
  programs: false,
  membership: false,
  applications: false,
}

export default function CustomerMyTransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your giving, program payments, venue rentals, and outstanding balances.
        </p>
      </div>

      <ContactFinancialPanel
        variant="customer"
        contactId=""
        contactName="You"
        modules={EMPTY_MODULES}
        hideIdentity
      />
    </div>
  )
}
