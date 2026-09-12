// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.3 — Birim dönüşümü (localStorage tarafı)
//
// db/migrations/0002_birimler.sql'deki `uom_conversion` tablosu ve
// `app.convert_uom()` fonksiyonuyla BİREBİR aynı sayılar. PostgresStockRepository
// veritabanındaki fonksiyonu çağıracak; LocalStorageStockRepository için aynı
// tablo burada sabit olarak tutuluyor. İkisi ayrışırsa I7 iki uygulamada farklı
// sonuç verir — bu yüzden bu dosyayı değiştirirken 0002'yi de güncelle.
// ═══════════════════════════════════════════════════════════════════════════

type ConversionKey = `${string}:${string}`

const CONVERSIONS: Record<ConversionKey, number> = {
  'kg:g': 1000,
  'g:kg': 0.001,
  'ton:kg': 1000,
  'kg:ton': 0.001,
  'ton:g': 1000000,
  'g:ton': 0.000001,
  'lt:ml': 1000,
  'ml:lt': 0.001,
}

/**
 * Miktarı hedef birime çevirir. Tanımsız dönüşümde hata verir — Postgres
 * tarafındaki `app.convert_uom()` ile aynı davranış (I7).
 */
export function convertUom(qty: number, fromUom: string, toUom: string): number {
  if (fromUom === toUom) {
    return qty
  }

  const factor = CONVERSIONS[`${fromUom}:${toUom}`]
  if (factor === undefined) {
    throw new Error(`Birim dönüşümü tanımlı değil: ${fromUom} → ${toUom}`)
  }

  return qty * factor
}
