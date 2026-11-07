// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — `document.title`a YAZAN TEK YER VAR
//
// ⚠️ NEDEN DONDURULUYOR: iki yazar olsaydı biri diğerini sessizce ezerdi.
// `App.tsx` başlığı işletme adına kurarken ikinci bir yazar zil önekini
// siler, sayı rastgele kaybolur ve kimse sebebini bulamazdı — "bazen
// görünüyor, bazen görünmüyor" diye bir hata, bulunması en pahalı hata
// türüdür.
//
// Bu yüzden kural şu: `document.title`a yazan tek dosya `App.tsx`tir ve
// yazdığı değeri `sekmeBasligi()` üretir.
//
// ⚠️ Ölçüm YORUMSUZ METNE bakıyor (tuzak 181, bu depoda üç kez yakalandı):
// yukarıdaki açıklamada `document.title` geçiyor ve yorumu okuyan bir
// sayım kendi açıklamasını ikinci yazar sanardı.
// ═══════════════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { yorumsuzKod } from '../core/test-support/kaynak-soyma'

const KAYNAK = join(process.cwd(), 'src')

const dosyalar = (klasor: string): string[] => {
  const cikti: string[] = []
  for(const ad of readdirSync(klasor)){
    const yol = join(klasor, ad)
    if(statSync(yol).isDirectory()){ cikti.push(...dosyalar(yol)); continue }
    if(/\.(ts|tsx)$/.test(ad)) cikti.push(yol)
  }
  return cikti
}

const APP = readFileSync(join(KAYNAK, 'App.tsx'), 'utf8')

describe('sekme başlığı · tek yazar kuralı', () => {
  it('⚠️ `document.title`a yazan TEK dosya App.tsx', () => {
    const yazanlar: string[] = []
    for(const yol of dosyalar(KAYNAK)){
      const kod = yorumsuzKod(readFileSync(yol, 'utf8'))
      if(/document\s*\.\s*title\s*=/.test(kod)){
        yazanlar.push(yol.slice(KAYNAK.length + 1).replace(/\\/g, '/'))
      }
    }
    expect(yazanlar.sort()).toEqual(['App.tsx'])
  })

  it('sağlama: o tek yazım gerçekten var (kontrol boşlukta yeşil yanmıyor)', () => {
    expect(/document\s*\.\s*title\s*=/.test(yorumsuzKod(APP))).toBe(true)
  })

  it('⚠️ yazılan değer `sekmeBasligi()`den geçiyor', () => {
    const kod = yorumsuzKod(APP)
    expect(kod).toMatch(/document\s*\.\s*title\s*=\s*sekmeBasligi\(/)
    expect(kod).toContain("from './notifications/sekme-basligi'")
  })

  // ⚠️ Sayı AppShell'de hesaplanıyor (zil orada), başlık App'te yazılıyor.
  // Araya bir geri çağırma konmazsa sayı yukarı hiç çıkmaz ve başlık
  // sessizce hep sayısız kalır — yani özellik "var" görünüp çalışmaz.
  it('okunmamış sayısı AppShell\'den App\'e geri bildiriliyor', () => {
    const kabuk = yorumsuzKod(readFileSync(join(KAYNAK, 'components', 'AppShell.tsx'), 'utf8'))
    expect(kabuk).toContain('onUnreadNotificationCountChange')
    expect(yorumsuzKod(APP)).toContain('onUnreadNotificationCountChange=')
  })

  // ⚠️ Emrah'ın kuralı (07.11): "zil okunmamışları saysın, okununca bir
  // daha bildirim vermesin ama okunan bildirim yine aynı yerde dursun."
  // Başlık da ROZETLE AYNI sayıyı göstermeli; iki yerde iki farklı sayı,
  // ikisine de güveni bitirir.
  it('başlık rozetle AYNI sayıyı kullanıyor (okunmamış)', () => {
    const kabuk = yorumsuzKod(readFileSync(join(KAYNAK, 'components', 'AppShell.tsx'), 'utf8'))
    expect(kabuk).toMatch(/onUnreadNotificationCountChange\?\.\(\s*unreadNotificationCount\s*\)/)
  })
})
