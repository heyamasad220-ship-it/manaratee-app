"use client"

import { Header } from "@/components/layout/header"
import { OrdersTable } from "@/components/events/orders/orders-table"
import { TicketsStatsCards } from "@/components/events/orders/tickets-stats-cards"

export default function TicketsPage() {
  return (
    <>
      <Header title="Ticketing" />
      <div className="flex flex-col gap-5 p-6">
        <TicketsStatsCards />
        <OrdersTable />
      </div>
    </>
  )
}
