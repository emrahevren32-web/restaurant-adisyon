import { ClosedBill, Discount, Order, PaymentPart, Product } from './types'

// ═══════════════════════════════════════════════════════════════════════
// PARA BİRİMİ · TEK BESLEME NOKTASI · 01.11.2026 · HEDEFLER 3.4.6
//
// ── ÖNCESİ ──────────────────────────────────────────────────────────────
// Burada `const PARA_BIRIMI = 'TRY'` yazıyordu ve bu **yazılı bir borçtu**.
// Müşteri İşletme Ayarları'ndan EUR seçse bile bu dosyadan geçen ekranlar
// yine ₺ basıyordu. Bu dosyayı **38 ekran** kullanıyor.
//
// ── NEDEN DOĞRUDAN VERİTABANI OKUNMUYOR ─────────────────────────────────
// `formatCurrency` EŞZAMANLI ve ÇİZİM SIRASINDA çağrılıyor. İçine bir
// veritabanı okuması koymak, her fiyat yazdırmada ağ isteği demekti.
// Çözüm: değer DIŞARIDAN BİR KEZ beslenir, burası onu okur.
//
// ── "HENÜZ OKUNMADI" İLE "TRY" AYRI İKİ DURUM ───────────────────────────
// `null` = işletmenin seçimi daha okunmadı. O sırada ₺ basılıyor — çünkü
// göç 0103'ün tetiği her yeni kiracıyı zaten `TRY` ile açıyor, yani en
// olası doğru cevap bu. Ama ikisi KARIŞTIRILMIYOR: `null`ken gelen bir
// besleme, ekranı yeniden çizdiriyor (aşağıdaki dinleyici).
//
// ⚠️ ÇIKIŞTA SIFIRLANMALI. Aynı tarayıcıda başka bir işletmeye giriş
// yapılırsa, öncekinin para birimi ekranda kalırdı. `paraBirimiAyarla(null)`
// çıkışta çağrılıyor (App.tsx).
// ═══════════════════════════════════════════════════════════════════════

/** `null` = işletmenin seçimi HENÜZ OKUNMADI. 'TRY' ile aynı şey değildir. */
let aktifParaBirimi: string | null = null

type Dinleyici = () => void
const dinleyiciler = new Set<Dinleyici>()

/**
 * Para birimi değişince haber ver.
 *
 * ⚠️ Bu olmadan yarım bir çözüm olurdu: değer giriş sonrası GELİYOR ama
 * ekranda zaten ₺ yazılmış oluyordu. Dinleyici, gelen değerle ekranın
 * yeniden çizilmesini sağlıyor.
 */
export const paraBirimiDegisinceBildir = (dinleyici: Dinleyici) => {
  dinleyiciler.add(dinleyici)
  return () => { dinleyiciler.delete(dinleyici) }
}

/** İşletmenin para birimini besler. `null` → "okunmadı"ya döndürür (çıkış). */
export const paraBirimiAyarla = (kod: string | null) => {
  const yeni = (kod || '').trim().toUpperCase() || null
  if(yeni === aktifParaBirimi) return
  aktifParaBirimi = yeni
  bicimlendirici = null
  dinleyiciler.forEach(dinleyici => dinleyici())
}

/** Bugün kullanılan kod. Okunmadıysa 'TRY' (0103'ün tetiğinin varsayılanı). */
export const aktifParaBirimiKodu = () => aktifParaBirimi ?? 'TRY'

// ⚠️ Biçimlendirici ÖNBELLEKLENİYOR. Eskiden `formatCurrency` HER ÇAĞRIDA
// yeni bir `Intl.NumberFormat` kuruyordu; bir listede yüzlerce fiyat varsa
// yüzlerce kez. Para birimi değişince önbellek düşürülüyor (yukarıda).
let bicimlendirici: Intl.NumberFormat | null = null

const createCurrencyFormatter = () => {
  if(bicimlendirici) return bicimlendirici
  const currency = aktifParaBirimiKodu()

  try {
    bicimlendirici = new Intl.NumberFormat('tr-TR', { style: 'currency', currency })
  } catch {
    // Geçersiz kod geldiyse ₺'ye düşülüyor — ama SESSİZCE değil:
    // kod zaten `PARA_BIRIMLERI` listesinden geçerek geliyor, buraya
    // düşmek bir hatadır ve konsola yazılıyor.
    console.warn(`[MİYOP] Geçersiz para birimi kodu: ${currency}. ₺ kullanılıyor.`)
    bicimlendirici = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
  }
  return bicimlendirici
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
