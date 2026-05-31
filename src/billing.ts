import { ClosedBill, Discount, Order, PaymentPart, Product } from './types'
import { loadSettings } from './storage'

const createCurrencyFormatter = () => {
  const currency = loadSettings().currency || 'TRY'

  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency
    })
  } catch {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    })
  }
}

export const formatCurrency = (value: number) => createCurrencyFormatter().format(value)

export const roundCurrency = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

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

export const calculateProratedDiscountTotal = (
  discount: Discount | undefined,
  subtotal: number,
  sourceSubtotal = subtotal
) => {
  if(!discount || subtotal <= 0) return 0

  if(discount.type === 'amount' && sourceSubtotal > 0 && subtotal < sourceSubtotal){
    const sourceDiscount = calculateDiscountTotal(discount, sourceSubtotal)
    return roundCurrency(Math.min(subtotal, sourceDiscount * (subtotal / sourceSubtotal)))
  }

  return roundCurrency(calculateDiscountTotal(discount, subtotal))
}

export const calculateFinalTotal = (orders: Order[], products: Product[], discount?: Discount) => {
  const subtotal = calculateSubtotal(orders, products)
  return roundCurrency(Math.max(0, subtotal - calculateDiscountTotal(discount, subtotal)))
}

export const normalizePayments = (payments: PaymentPart[] = []) => {
  return payments
    .map(payment => ({
      method: payment.method,
      amount: roundCurrency(Number(payment.amount))
    }))
    .filter(payment => Number.isFinite(payment.amount) && payment.amount > 0)
}

export const calculatePaymentsTotal = (payments: PaymentPart[] = []) => {
  return roundCurrency(normalizePayments(payments).reduce((sum, payment) => sum + payment.amount, 0))
}

export const paymentsCoverTotal = (payments: PaymentPart[] = [], total: number) => {
  const normalizedTotal = roundCurrency(Math.max(0, total))
  const normalizedPayments = normalizePayments(payments)
  const paymentTotal = calculatePaymentsTotal(normalizedPayments)

  if(normalizedTotal === 0) return paymentTotal === 0

  return normalizedPayments.length > 0 && Math.abs(paymentTotal - normalizedTotal) <= 0.01
}

export const getBillPayments = (bill: ClosedBill): PaymentPart[] => {
  if(bill.mergeHistory) return []

  const payments = normalizePayments(bill.payments)
  if(payments.length > 0) return payments

  if(bill.total <= 0) return []

  return [{
    method: bill.paymentMethod || 'Nakit',
    amount: roundCurrency(bill.total)
  }]
}

export const isRevenueBill = (bill: ClosedBill) => {
  return bill.mergeHistory !== true
}
