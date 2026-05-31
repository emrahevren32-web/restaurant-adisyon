import { Discount, Order, Product } from './types'

export const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY'
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

export const getOrderUnitPrice = (order: Order, products: Product[]) => {
  const product = products.find(item => item.id === order.productId)
  return order.unitPrice ?? product?.price ?? 0
}

export const calculateOrderOriginalTotal = (order: Order, products: Product[]) => {
  return getOrderUnitPrice(order, products) * order.qty
}

export const calculateOrderPayableTotal = (order: Order, products: Product[]) => {
  if(order.isGift) return 0
  return calculateOrderOriginalTotal(order, products)
}

export const calculateSubtotal = (orders: Order[], products: Product[]) => {
  return orders.reduce((sum, order) => sum + calculateOrderPayableTotal(order, products), 0)
}

export const calculateGiftTotal = (orders: Order[], products: Product[]) => {
  return orders.reduce((sum, order) => sum + (order.isGift ? calculateOrderOriginalTotal(order, products) : 0), 0)
}

export const calculateDiscountTotal = (discount: Discount | undefined, subtotal: number) => {
  if(!discount || !Number.isFinite(discount.value) || discount.value <= 0) return 0

  if(discount.type === 'percent'){
    const percent = Math.min(Math.max(discount.value, 0), 100)
    return Math.min(subtotal, subtotal * percent / 100)
  }

  return Math.min(subtotal, Math.max(discount.value, 0))
}

export const calculateFinalTotal = (orders: Order[], products: Product[], discount?: Discount) => {
  const subtotal = calculateSubtotal(orders, products)
  return Math.max(0, subtotal - calculateDiscountTotal(discount, subtotal))
}
