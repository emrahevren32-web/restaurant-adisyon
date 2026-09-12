// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Excel içe aktarma, stok miktarı KAPIDAN geçiyor
//
// Bu test tek bir kuralı koruyor (ADR-001):
//   «Miktar defterden türetilir, dışarıdan atanmaz.»
//
// Eskiden Excel içe aktarma `currentQty` alanını doğrudan yazıyordu. Sonuç:
// hareketi olmayan bir bakiye — "bu rakam nereden geldi?" sorusunun cevabı yok.
// Artık Excel'deki miktar bir AÇILIŞ SAYIMI olarak `applyStockMovement()`
// kapısından geçiyor.
//
// Testler `ExcelImportService.commitImport()` üzerinden koşuyor, yani gerçek
// giriş noktasından — iç fonksiyonu doğrudan çağırıp kendimize kolaylık
// sağlasaydık, akıştaki bir kopukluğu göremezdik.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import { ExcelImportService } from './excel-import.service'
import type { ExcelImportResult, ExcelJob, ExcelRow } from './excel-engine.types'
import type { User } from '../types'
import { loadStockItems, loadStockMovements, setCurrentUser } from '../storage'

const KULLANICI: User = {
  id: 'user-excel-test',
  fullName: 'Excel Sınama',
  username: 'excel.sinama',
  role: 'Admin',
  active: true
}

/**
 * `commitImport` yalnızca şu alanları okuyor; `job` alanı ise girdi olarak
 * kullanılmıyor, sonuç için yenisi üretiliyor. Bu yüzden asgari bir kabuk
 * yeterli — gerçek bir .xlsx dosyası ayrıştırmaya gerek yok.
 */
const iceAktar = (rows: ExcelRow[]) => {
  const onizleme: ExcelImportResult = {
    job: {} as ExcelJob,
    moduleKey: 'stock',
    fileName: 'sinama.xlsx',
    rows,
    validRows: rows,
    invalidRows: [],
    errors: [],
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    committed: false
  }
  return ExcelImportService.commitImport(onizleme, KULLANICI)
}

const kalem = (ad: string) => loadStockItems().find(item => item.name === ad)
const hareketler = (ad: string) => loadStockMovements().filter(m => m.stockItemName === ad)

beforeEach(() => {
  localStorage.clear()
  setCurrentUser(KULLANICI)
})

describe('Excel içe aktarma · stok miktarı', () => {
  it('miktar deftere bir sayım hareketi olarak yazılıyor', () => {
    iceAktar([{
      name: 'Test Un',
      categoryName: 'Hammadde',
      unit: 'kg',
      currentQty: 120,
      tracksExpiry: 'hayir'
    }])

    expect(kalem('Test Un')?.currentQty).toBe(120)

    const kayitlar = hareketler('Test Un')
    expect(kayitlar).toHaveLength(1)
    expect(kayitlar[0].type).toBe('Sayım Düzeltme')
    expect(kayitlar[0].source).toBe('Sayım')
    expect(kayitlar[0].nextQty).toBe(120)
  })

  it('bakiye HER ZAMAN bir hareketin sonucudur — hareketsiz miktar oluşmuyor', () => {
    // Asıl kural bu. Yukarıdaki test "hareket var mı" diye sorar; bu test
    // "kartın rakamı ile defterin son sözü aynı mı" diye sorar.
    iceAktar([{
      name: 'Test Un',
      categoryName: 'Hammadde',
      unit: 'kg',
      currentQty: 75,
      tracksExpiry: 'hayir'
    }])

    const kayitlar = hareketler('Test Un')
    expect(kayitlar).not.toHaveLength(0)
    expect(kalem('Test Un')?.currentQty).toBe(kayitlar[0].nextQty)
  })

  it('SKT takipli kaleme tarihsiz miktar yazılamıyor — kart gelir, miktar gelmez', () => {
    // Endüstriyel mutfakta izlenemeyen parti kabul edilemez. Sessizce geçmek
    // yerine kullanıcıya söyleniyor.
    const sonuc = iceAktar([{
      name: 'Test Tavuk',
      categoryName: 'Hammadde',
      unit: 'kg',
      currentQty: 50
      // tracksExpiry verilmedi → yeni kalemde varsayılan: takip AÇIK
      // expiryDate verilmedi → miktar aktarılmamalı
    }])

    expect(kalem('Test Tavuk')).toBeDefined()
    expect(kalem('Test Tavuk')?.currentQty).toBe(0)
    expect(hareketler('Test Tavuk')).toHaveLength(0)

    const skt = sonuc.errors.filter(hata => hata.columnKey === 'expiryDate')
    expect(skt).toHaveLength(1)
    expect(skt[0].message).toContain('Test Tavuk')

    // Kartlar geldiği için iş BAŞARISIZ değil; uyarı ise kaybolmuyor.
    expect(sonuc.committed).toBe(true)
    expect(sonuc.job.status).toBe('SUCCESS')
  })

  it('SKT verilirse miktar geçiyor', () => {
    iceAktar([{
      name: 'Test Tavuk',
      categoryName: 'Hammadde',
      unit: 'kg',
      currentQty: 50,
      expiryDate: '2027-01-31'
    }])

    expect(kalem('Test Tavuk')?.currentQty).toBe(50)
    expect(hareketler('Test Tavuk')).toHaveLength(1)
  })

  it('miktar sütunu boşsa mevcut bakiye korunuyor', () => {
    iceAktar([{
      name: 'Test Un', categoryName: 'Hammadde', unit: 'kg',
      currentQty: 120, tracksExpiry: 'hayir'
    }])

    // İkinci dosya yalnızca kart bilgisini güncelliyor.
    iceAktar([{
      name: 'Test Un', categoryName: 'Hammadde', unit: 'kg', minQty: 30
    }])

    expect(kalem('Test Un')?.currentQty).toBe(120)
    expect(kalem('Test Un')?.minQty).toBe(30)
    expect(hareketler('Test Un')).toHaveLength(1)
  })

  it('aynı miktar tekrar aktarılırsa yeni hareket yazılmıyor', () => {
    const satir: ExcelRow = {
      name: 'Test Un', categoryName: 'Hammadde', unit: 'kg',
      currentQty: 120, tracksExpiry: 'hayir'
    }
    iceAktar([satir])
    iceAktar([{ ...satir }])

    expect(kalem('Test Un')?.currentQty).toBe(120)
    expect(hareketler('Test Un')).toHaveLength(1)
  })

  it('miktar düşürülürse eksik sayımı olarak yazılıyor', () => {
    iceAktar([{
      name: 'Test Un', categoryName: 'Hammadde', unit: 'kg',
      currentQty: 120, tracksExpiry: 'hayir'
    }])
    iceAktar([{
      name: 'Test Un', categoryName: 'Hammadde', unit: 'kg',
      currentQty: 80, tracksExpiry: 'hayir'
    }])

    expect(kalem('Test Un')?.currentQty).toBe(80)
    const kayitlar = hareketler('Test Un')
    expect(kayitlar).toHaveLength(2)
    expect(kayitlar.some(m => m.reason === 'Sayım Eksiği')).toBe(true)
  })
})
