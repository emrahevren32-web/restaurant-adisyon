import type { Supplier, SupplierAddress } from './supplier-management.types'

export const SupplierAddressService = {
  createPrimaryAddress: (supplier: Supplier): SupplierAddress => ({
    id: `${supplier.id}_address_primary`,
    supplierId: supplier.id,
    title: 'Merkez Adres',
    address: supplier.address,
    city: supplier.city,
    district: supplier.district,
    postalCode: supplier.postalCode,
    country: supplier.country,
    isPrimary: true
  }),

  listAddresses: (supplier: Supplier): SupplierAddress[] => [
    SupplierAddressService.createPrimaryAddress(supplier)
  ],

  getAddressLabel: (supplier: Supplier) => (
    [supplier.address, supplier.district, supplier.city, supplier.postalCode, supplier.country]
      .filter(Boolean)
      .join(' / ') || '-'
  )
}
