// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 müşteri kartı · biçimlendirme kuralları
//
// Buradaki tek kural şu: BİLİNMEYENİ UYDURMA.
// "0 ₺" ile "fiyat belirlenmedi" aynı şey değil. "0 kullanıcı" ile
// "kullanıcı sayısını bilmiyoruz" aynı şey değil. Platform sahibi bu ikisini
// karıştırırsa yanlış karar verir; bu yüzden kural testle tutuluyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  BOS, bosDegilse, gunFarkiMetni, kisaTarih, paraVeyaBelirsiz,
  sektorAdi, tarihSaat, zamanAraligi
} from './platform-musteri.bicim'

describe('boş değer uydurulmuyor', () => {
  it('boş metin "—" olur, "Yok" ya da "0" değil', () => {
    for(const bos of ['', '   ', null, undefined]){
      expect(bosDegilse(bos as string)).toBe(BOS)
    }
    expect(bosDegilse(' ABC Gıda ')).toBe('ABC Gıda')
  })

  it('boş tarih "—" olur, bugünün tarihi değil', () => {
    expect(kisaTarih('')).toBe(BOS)
    expect(kisaTarih(null)).toBe(BOS)
    expect(kisaTarih('anlamsiz')).toBe(BOS)
    expect(tarihSaat('')).toBe(BOS)
  })

  it('boş zaman damgası "hiç" demiyor — bilmiyoruz demek', () => {
    expect(zamanAraligi('')).toBe(BOS)
    expect(zamanAraligi(null)).toBe(BOS)
  })

  it('kalan gün yoksa "0 gün" yazmıyor', () => {
    expect(gunFarkiMetni(null)).toBe(BOS)
    expect(gunFarkiMetni(undefined)).toBe(BOS)
    expect(gunFarkiMetni(0)).toBe('bugün bitiyor')
    expect(gunFarkiMetni(12)).toBe('12 gün')
    expect(gunFarkiMetni(-3)).toBe('3 gün geçti')
  })
})

describe('fiyat belirlenmediyse SAYI gösterilmiyor', () => {
  it('"0 ₺" asla yazılmıyor — bedava demek olurdu', () => {
    const cikti = paraVeyaBelirsiz(0, false)
    expect(cikti).toBe('Fiyat henüz belirlenmedi')
    expect(cikti).not.toContain('0')
    expect(cikti).not.toContain('₺')
  })

  it('fiyat belirlendiyse para biçiminde yazılıyor', () => {
    const cikti = paraVeyaBelirsiz(1500, true)
    expect(cikti).toContain('1.500')
  })

  it('belirlenmiş ama değeri bilinmiyorsa "—"', () => {
    expect(paraVeyaBelirsiz(null, true)).toBe(BOS)
  })
})

describe('zaman aralığı insan diliyle', () => {
  const once = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('dakika, saat, gün, ay basamaklarını geçiyor', () => {
    expect(zamanAraligi(once(30_000))).toBe('az önce')
    expect(zamanAraligi(once(5 * 60_000))).toBe('5 dk önce')
    expect(zamanAraligi(once(3 * 3_600_000))).toBe('3 saat önce')
    expect(zamanAraligi(once(4 * 86_400_000))).toBe('4 gün önce')
    expect(zamanAraligi(once(70 * 86_400_000))).toBe('2 ay önce')
    expect(zamanAraligi(once(400 * 86_400_000))).toBe('1 yıl önce')
  })
})

describe('sektör adı', () => {
  it('iki ayrı yazımı da tanıyor', () => {
    // company.primary_sector_id
    expect(sektorAdi('sector_industrial_kitchen')).toBe('Endüstriyel Mutfak')
    // business_application.sector_code
    expect(sektorAdi('endustriyel-mutfak')).toBe('Endüstriyel Mutfak')
  })

  it('tanımadığı kodu UYDURMUYOR, ham hâliyle gösteriyor', () => {
    expect(sektorAdi('bilinmeyen-sektor')).toBe('bilinmeyen-sektor')
    expect(sektorAdi('')).toBe(BOS)
  })
})
