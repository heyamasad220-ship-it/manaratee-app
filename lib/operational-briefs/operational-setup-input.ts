export type OperationalSetupInput = {
  expectedAttendance?: number | null
  chairsPerTable?: number | null
  setupStyle?: string | null
  roomSetupNotes?: string | null
  equipmentNotes?: string | null
  foodBeverageNotes?: string | null
  tableLinenNotes?: string | null
  cleanupNotes?: string | null
  accessibilityNotes?: string | null
  facilityNotes?: string | null
  primaryContactPhone?: string | null
}

export function mergeOperationalSetupIntoUpsert<
  T extends Record<string, unknown>,
>(target: T, setup?: OperationalSetupInput | null): T {
  if (!setup) return target

  return {
    ...target,
    ...(setup.expectedAttendance !== undefined
      ? { expected_attendance: setup.expectedAttendance }
      : {}),
    ...(setup.chairsPerTable !== undefined
      ? { chairs_per_table: setup.chairsPerTable }
      : {}),
    ...(setup.setupStyle !== undefined ? { setup_style: setup.setupStyle } : {}),
    ...(setup.roomSetupNotes !== undefined
      ? { room_setup_notes: setup.roomSetupNotes }
      : {}),
    ...(setup.equipmentNotes !== undefined
      ? { equipment_notes: setup.equipmentNotes }
      : {}),
    ...(setup.foodBeverageNotes !== undefined
      ? { food_beverage_notes: setup.foodBeverageNotes }
      : {}),
    ...(setup.tableLinenNotes !== undefined
      ? { table_linen_notes: setup.tableLinenNotes }
      : {}),
    ...(setup.cleanupNotes !== undefined ? { cleanup_notes: setup.cleanupNotes } : {}),
    ...(setup.accessibilityNotes !== undefined
      ? { accessibility_notes: setup.accessibilityNotes }
      : {}),
    ...(setup.facilityNotes !== undefined ? { facility_notes: setup.facilityNotes } : {}),
    ...(setup.primaryContactPhone !== undefined
      ? { primary_contact_phone: setup.primaryContactPhone }
      : {}),
  }
}
