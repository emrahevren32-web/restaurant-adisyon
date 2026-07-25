import {
  SUPPLIER_STATUS_LABELS,
  loadSupplierManagementRecords,
  saveSupplierManagementRecords
} from './supplier-management.mock'
import type { Supplier, SupplierStatus } from './supplier-management.types'

export const SupplierService = {
  listSuppliers: (): Supplier[] => loadSupplierManagementRecords(),

  saveSuppliers: (suppliers: Supplier[]) => {
    saveSupplierManagementRecords(suppliers)
  },

  getNextSupplierCode: (suppliers: Supplier[]) => {
    const maxNo = suppliers.reduce((max, supplier) => {
      const match = supplier.supplierCode.match(/(\d+)$/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)

    return `TD-${String(maxNo + 1).padStart(3, '0')}`
  },

  createId: () => `supplier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,

  isOperational: (supplier: Supplier) => (
    supplier.status === 'ACTIVE' && supplier.workingStatus === 'ACTIVE_WORKING'
  ),

  getStatusLabel: (status: SupplierStatus) => (
    SUPPLIER_STATUS_LABELS[status]
  )
}
