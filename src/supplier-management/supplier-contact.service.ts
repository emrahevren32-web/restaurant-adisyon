import type { Supplier, SupplierContact } from './supplier-management.types'

export const SupplierContactService = {
  createPrimaryContact: (supplier: Supplier): SupplierContact => ({
    id: `${supplier.id}_contact_primary`,
    supplierId: supplier.id,
    fullName: supplier.contactName,
    title: 'Yetkili Kişi',
    phone: supplier.contactPhone,
    mobilePhone: supplier.mobilePhone,
    email: supplier.contactEmail,
    isPrimary: true,
    notes: supplier.notes
  }),

  listContacts: (supplier: Supplier): SupplierContact[] => [
    SupplierContactService.createPrimaryContact(supplier)
  ],

  getContactLabel: (supplier: Supplier) => (
    [supplier.contactName, supplier.contactPhone || supplier.mobilePhone, supplier.contactEmail]
      .filter(Boolean)
      .join(' / ') || '-'
  )
}
