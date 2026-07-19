export type SupplierReturnTransportMethod =
  | 'COMPANY_VEHICLE'
  | 'SUPPLIER_PICKUP'
  | 'CARGO'
  | 'THIRD_PARTY'
  | 'OTHER'

export type SupplierReturnStatus =
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'

export type SupplierReturn = {
  id: string
  supplierReturnNo: string
  returnProcessId: string
  supplierId: string
  warehouseId: string
  shipmentDate: string
  deliveryDate: string
  trackingNumber: string
  transportMethod: SupplierReturnTransportMethod
  receiverName: string
  status: SupplierReturnStatus
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
