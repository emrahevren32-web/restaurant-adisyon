// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — STOKA YAZAN TEK KAPI (mimari testi)
//
// Yol haritası maddesi: "postMovement() — stoka yazan tek kapı"
//                       Bitti sayılır ki: "Başka hiçbir kod yolu stoka yazmıyor"
//
// Bu kriter tek bir incelemeyle kanıtlanamaz: bugün doğru olsa bile yarın
// birinin yazacağı üç satır onu sessizce yanlış hâle getirir. Bu yüzden kriteri
// bir TESTE çeviriyoruz — kaynak ağacını tarar ve stok defterine ya da stok
// kartına doğrudan yazan her dosyayı bulur. Çizelgede olmayan bir dosya çıkarsa
// test kırmızıya döner.
//
// ── ÇİZELGE BİR AKLAMA DEĞİL, BİR BORÇ LİSTESİDİR ─────────────────────────
// Listedeki her satır "bu dosya bugün kapıyı atlıyor" demektir. Amaç listeyi
// büyütmek değil BOŞALTMAK. Liste boşaldığında madde işaretlenebilir — önce
// değil.
//
// Test iki yönde de sıkı çalışır:
//   • listede OLMAYAN bir ihlal → kırmızı ("yeni bir kaçak yol açılmış")
//   • listede olup artık VAR OLMAYAN bir kayıt → kırmızı ("kapanmış, çıkar")
// İkincisi bilerek böyle: kapanmış bir borcun çizelgede kalması, çizelgeyi
// zamanla yalancı yapar.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Proje kökü: testler kökten koşuluyor, ama bir gün başka bir dizinden
// koşulursa test "hiç dosya bulamadım" diye SESSİZCE geçmemeli — o en kötü
// sonuç olurdu. Bulamazsa açıkça patlar; ayrıca aşağıda bir sağlama testi var.
const projeKokunuBul = (): string => {
  let dizin = process.cwd()
  for(let i = 0; i < 6; i++){
    if(existsSync(join(dizin, 'src', 'storage.ts'))) return dizin
    const ust = join(dizin, '..')
    if(ust === dizin) break
    dizin = ust
  }
  throw new Error(
    'Proje kökü bulunamadı (src/storage.ts aranıyordu). ' +
    'Bu test kaynak ağacını tarayabilmek için köke ihtiyaç duyuyor.'
  )
}

const KOK = projeKokunuBul()

const dosyalariTopla = (dizin: string, toplanan: string[] = []): string[] => {
  for(const ad of readdirSync(dizin)){
    if(ad === 'node_modules' || ad === 'dist' || ad.startsWith('.')) continue
    const tamYol = join(dizin, ad)
    if(statSync(tamYol).isDirectory()){
      dosyalariTopla(tamYol, toplanan)
    } else if(/\.(ts|tsx)$/.test(ad) && !/\.(test|spec|suite)\.tsx?$/.test(ad)){
      // Test dosyaları taranmaz: bu dosyanın kendisi de aranan adları içeriyor,
      // ve bir testin başka bir testi ihlal sayması saçma olurdu.
      toplanan.push(tamYol)
    }
  }
  return toplanan
}

type KaynakDosya = { yol: string; icerik: string }

// Yol her işletim sisteminde aynı görünsün: Windows'ta '\', Linux'ta '/'.
const kaynakDosyalari: KaynakDosya[] = dosyalariTopla(join(KOK, 'src')).map(tamYol => ({
  yol: relative(KOK, tamYol).split(sep).join('/'),
  icerik: readFileSync(tamYol, 'utf-8')
}))

/**
 * Bir tanımlayıcıyı YALNIZCA gerçek kullanım olarak arar.
 *
 * Kelime sınırı (`\b`) şart: `saveStockItems` deseni `saveAllStockItems`
 * içinde eşleşmemeli — eşleşseydi iki ayrı yazma yolu tek yolmuş gibi
 * görünürdü. Yorum satırları da eleniyor; bir dosyadaki
 * "// saveStockItems kullanma" notu ihlal sayılmamalı.
 */
const kullananDosyalar = (tanimlayicilar: string[]): string[] => {
  const desen = new RegExp(`\\b(${tanimlayicilar.join('|')})\\b`)
  return kaynakDosyalari
    .filter(({ icerik }) =>
      icerik
        .split('\n')
        .map(satir => satir.replace(/\/\/.*$/, ''))
        .filter(satir => !/^\s*\*/.test(satir))
        .some(satir => desen.test(satir))
    )
    .map(({ yol }) => yol)
    .sort()
}

// ═══════════════════════════════════════════════════════════════════════════
// BORÇ ÇİZELGESİ — 2026-08-28
// ═══════════════════════════════════════════════════════════════════════════

/** Stok DEFTERİNE (hareket kaydına) yazan dosyalar. */
const DEFTERE_YAZANLAR = [
  // ✅ KAPI. `applyStockMovement()` burada yaşıyor: miktarı hesaplar, SKT lotunu
  //    tüketir veya oluşturur, maliyeti günceller, denetim kaydı düşer.
  //    Eski kodun tek meşru yazma yolu budur.
  'src/storage.ts'

  // 2026-08-31: sevkiyat borcu KAPANDI. Servis artık kendi hareketini kurmuyor;
  // `applyStockMovement()` çağırıyor. Kapıyı atlamasının sebebi dikkatsizlik
  // değil, kapının şube kapsamlı olmasıydı — sevkiyat ise şubeler arası bir iş.
  // `withBranchScope()` eklendi (storage.ts) ve boşluk kapandı.
].sort()

/** Stok KARTINA (`currentQty` dahil) yazan dosyalar. */
const KARTA_YAZANLAR = [
  // ✅ KAPI.
  'src/storage.ts',

  // ✅ MEŞRU. Yalnızca kart bilgisini yazıyor (ad, kategori, kritik seviye).
  //    Miktara DOKUNMUYOR: düzenlemede `currentQty: editingItem.currentQty` ile
  //    eskisini aynen taşıyor, yeni kartta `currentQty: 0` ile başlıyor.
  //    Yani burada da defter tek doğruluk kaynağı.
  'src/pages/StockCards.tsx',

  // ✅ MEŞRU (2026-08-28'de düzeltildi). Eskiden `currentQty` alanını Excel
  //    sütunundan DOĞRUDAN yazıyordu — ADR-001'in "miktar defterden türetilir"
  //    kuralının açık ihlaliydi: ortada hareketi olmayan bir bakiye oluşuyordu.
  //    Artık iki aşamalı — kart bilgisi buradan yazılıyor (miktara dokunmadan),
  //    Excel'deki miktar ise `applyStockMovement()` kapısından bir "Sayım
  //    Düzeltme" hareketi olarak geçiyor. Bkz. excel-import.service.ts
  'src/excel-engine/excel-import.service.ts',

  // ✅ MEŞRU (2026-08-31'de düzeltildi). Hedef şubede kart yoksa açıyor —
  //    `currentQty: 0` ile. Miktara DOKUNMUYOR; bakiye `applyStockMovement()`
  //    üzerinden bir "Giriş" hareketi olarak geliyor. Excel içe aktarmadaki
  //    iki aşamalı düzenin aynısı: kart bilgisi buradan, bakiye kapıdan.
  'src/shipment-executions/shipment-execution.service.ts'
].sort()

// ═══════════════════════════════════════════════════════════════════════════

const karsilastir = (baslik: string, bulunan: string[], beklenen: string[]) => {
  const yeni = bulunan.filter(yol => !beklenen.includes(yol))
  const kalmayan = beklenen.filter(yol => !bulunan.includes(yol))

  expect(
    yeni,
    `\n${baslik}: çizelgede olmayan YENİ bir yazma yolu açılmış.\n` +
    'Bu dosyalar stoka doğrudan yazıyor:\n' +
    yeni.map(y => `  • ${y}`).join('\n') +
    '\n\nYa yazmayı `applyStockMovement()` üzerinden geçir, ya da bilinçli bir\n' +
    'karar ise bu testteki çizelgeye SEBEBİYLE birlikte ekle.\n'
  ).toEqual([])

  expect(
    kalmayan,
    `\n${baslik}: iyi haber — bu dosyalar artık stoka doğrudan yazmıyor:\n` +
    kalmayan.map(y => `  • ${y}`).join('\n') +
    '\n\nBorç kapandı. Bu testteki çizelgeden çıkar ki çizelge dürüst kalsın.\n'
  ).toEqual([])
}

describe('Stoka yazan tek kapı (Aşama 2 · md. 27)', () => {
  it('tarama gerçekten kaynak dosyalarını görüyor', () => {
    // Bu sağlama olmadan, tarama bozulsaydı test "hiçbir ihlal bulamadım" deyip
    // yanlış sebepten yeşil yanardı — en tehlikeli sonuç bu olurdu.
    expect(kaynakDosyalari.length).toBeGreaterThan(150)
    expect(kaynakDosyalari.some(d => d.yol === 'src/storage.ts')).toBe(true)
  })

  it('deftere yazan dosyalar yalnızca çizelgedekiler', () => {
    karsilastir(
      'DEFTER',
      kullananDosyalar(['saveStockMovements', 'saveAllStockMovements']),
      DEFTERE_YAZANLAR
    )
  })

  it('stok kartına yazan dosyalar yalnızca çizelgedekiler', () => {
    karsilastir(
      'STOK KARTI',
      kullananDosyalar(['saveStockItems', 'saveAllStockItems']),
      KARTA_YAZANLAR
    )
  })

  it('eski kapı hâlâ yerinde duruyor', () => {
    const storage = kaynakDosyalari.find(d => d.yol === 'src/storage.ts')
    expect(storage?.icerik).toContain('export const applyStockMovement')
  })

  it('hedef kapı — StockRepository.postMovement — tanımlı', () => {
    // Aşama 2'nin bitişi iki şeydir: yukarıdaki borçların kapanması VE eski
    // kapının bu arayüzün arkasına geçmesi.
    const repo = kaynakDosyalari.find(d => d.yol === 'src/core/stock/stock.repository.ts')
    expect(repo?.icerik).toContain('postMovement')
  })

  it('BORÇ SAYACI — kapanmamış kaçak yol sayısı', () => {
    // Yukarıdaki çizelgede ✅ ile işaretlenenler: ya kapının kendisi, ya da
    // miktara hiç dokunmadan yalnızca kart bilgisi yazanlar.
    const MESRU = [
      'src/storage.ts',
      'src/pages/StockCards.tsx',
      'src/excel-engine/excel-import.service.ts',
      'src/shipment-executions/shipment-execution.service.ts'
    ]

    const borclu = new Set(
      [...DEFTERE_YAZANLAR, ...KARTA_YAZANLAR].filter(yol => !MESRU.includes(yol))
    )

    // ⚠️ Bu sayı yalnızca AZALMALI. Sıfır olduğu gün yol haritasındaki
    //    "postMovement() — stoka yazan tek kapı" maddesi hak edilmiş olur.
    //
    //    2026-08-28: 2 → 1. Excel içe aktarma kapıya bağlandı.
    //    2026-08-31: 1 → 0. Sevkiyat kapıya bağlandı; kapıya `withBranchScope()`
    //    eklenerek şubeler arası yazma ifade edilebilir hâle geldi.
    //
    //    ÇİZELGE BOŞ. Bu satır 0'dan büyüğe dönerse, kapanmış bir kural yeniden
    //    delinmiş demektir — o zaman sayıyı büyütmek değil, deliği kapatmak
    //    gerekir.
    expect(borclu.size).toBe(0)
    expect([...borclu]).toEqual([])
  })
})
