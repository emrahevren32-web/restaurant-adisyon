// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — ETİKET SAKLAMA KOŞULUNU ÜRÜN KARTINDAN OKUYOR
//
// ── NEDEN VAR (3.9.3 · 27.10.2026) ───────────────────────────────────────
// Göç 0093 saklama koşulunu `stock_item.storage_condition` sütununa koydu ve
// sütunun yorumuna şunu yazdı: *"Etiket de buradan okumalı."* **Okumuyordu.**
// Etiketteki Saklama satırı ekranda ELLE yazılıyordu ve hiçbir yere
// kaydedilmiyordu. Aynı lotun şahit numunesi koşulu KARTTAN kopyalıyor
// (0093/0094) — yani tek ürünün iki farklı saklama koşulu olabiliyordu: biri
// numune defterinde, biri ambalajın üstünde. Hangisinin doğru olduğunu kimse
// bilemezdi; ikisi de "kayıtlı" görünürdü.
//
// ⚠️ Bu testin ölçtüğü şey DOSYANIN METNİ. Sebep: sorun, bir sütunun
// `select` listesinde OLMAMASIYDI. Davranış testi bunu yakalayamaz — sahte
// depo neyi döndürürse onu döndürür; gerçek sorguyu hiç görmez.
//
// ⚠️ Tuzak 139: bu kuralı 0093'ün yorumuna yazmak UYARMADI. Yorum hatırlatır,
// test engeller.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const oku = (ad: string) =>
  readFileSync(join(KOK, 'src/production', ad), 'utf8') as string

const DEPO    = oku('label.repository.ts')
const SERVIS  = oku('label.service.ts')
const BELGE   = oku('label-documents.ts')

describe('etiket · saklama koşulu ürün kartından', () => {
  it('sağlama: üç dosya da okundu', () => {
    for(const [ad, m] of [['depo', DEPO], ['servis', SERVIS], ['belge', BELGE]] as const){
      expect(m.length, `${ad} okunamadı`).toBeGreaterThan(500)
    }
  })

  it('⚠️ kalem sorgusu storage_condition SÜTUNUNU okuyor', () => {
    // Bu satır düşerse etiket yine "çalışır" görünür ama saklama koşulu
    // sessizce karttan gelmez olur — tam olarak 3.9.3'ten önceki hâl.
    expect(
      DEPO,
      'label.repository.ts kalem sorgusunda `storage_condition` yok; '
      + 'etiket saklama koşulunu ürün kartından okuyamaz (3.9.3).',
    ).toMatch(/storage_condition/)
  })

  it('zorunluluk ölçütünün iki ayağı da okunuyor (lot ve SKT)', () => {
    expect(DEPO, '`tracks_lot` okunmuyor').toMatch(/tracks_lot/)
    expect(DEPO, '`tracks_expiry` okunmuyor').toMatch(/tracks_expiry/)
  })

  it('kalem tipi saklamayı ve iki takip bayrağını taşıyor', () => {
    expect(DEPO).toMatch(/saklama\?:\s*string/)
    expect(DEPO).toMatch(/lotTakipli:\s*boolean/)
    expect(DEPO).toMatch(/sktTakipli:\s*boolean/)
  })

  it('⚠️ KAYNAK SIRASI kartı önce koyuyor', () => {
    // `kalem.saklama || girdi.saklama` — bu sıra tersine dönerse ekran
    // kartla çelişen bir etiket basabilir ve güvence biter.
    expect(
      SERVIS,
      'label.service.ts saklama koşulunda ürün kartını önce denemiyor.',
    ).toMatch(/kirp\(girdi\.kalem\.saklama\)\s*\|\|\s*kirp\(girdi\.saklama\)/)
  })

  it('zorunluluk ÜRÜNDEN türetiliyor, ekrandan gelmiyor', () => {
    expect(SERVIS).toMatch(/saklamaZorunluMu\(girdi\.kalem\)/)
    expect(SERVIS).toMatch(/kalem\.lotTakipli\s*\|\|\s*kalem\.sktTakipli/)
    // Ekran `saklamaZorunlu` diye bir girdi GÖNDEREMEMELİ.
    const girdiBasi = SERVIS.indexOf('export const etiketVerisiKur')
    const girdiSonu = SERVIS.indexOf('}): EtiketVerisi', girdiBasi)
    expect(
      SERVIS.slice(girdiBasi, girdiSonu),
      'etiketVerisiKur girdisinde `saklamaZorunlu` var — zorunluluk ekranın '
      + 'söyleyeceği bir şey değil, ürünün özelliği.',
    ).not.toMatch(/saklamaZorunlu/)
  })

  it('taslak ölçütü yalnız ZORUNLU üründe çalışıyor', () => {
    expect(BELGE, 'eksik kontrolü zorunluluğa bakmıyor')
      .toMatch(/v\.saklamaZorunlu\s*&&\s*!v\.saklama/)
  })
})
