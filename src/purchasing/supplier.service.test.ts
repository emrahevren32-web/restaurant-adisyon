// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Tedarikçi servisi testleri
//
// Yol haritası maddesi: "Tedarikçi kayıtları"
//                       Bitti sayılır ki: "Ekle, düzenle, pasife al çalışıyor"
//
// Depo yerine BELLEKTEKİ bir depo kullanılıyor: burada sınanan şey Postgres'in
// çalışıp çalışmadığı değil, servisin kurallarının doğru olup olmadığı.
// Kiracı yalıtımı ve tekillik kısıtı veritabanının işi (0017 + ADR-004) ve
// onlar RLS testleriyle ayrıca kanıtlandı.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'
import {
  TedarikciKoduCakismasiError,
  type Tedarikci,
  type TedarikciDeposu,
  type TedarikciGirdisi,
} from './supplier.repository'
import {
  TedarikciDogrulamaError,
  TedarikciServisi,
  tedarikcileriSuz,
} from './supplier.service'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

/** Bellekte yaşayan depo. Tekillik kısıtını veritabanı gibi uyguluyor. */
class BellekDeposu implements TedarikciDeposu {
  kayitlar: Tedarikci[] = []
  private sayac = 0

  async hepsi(): Promise<Tedarikci[]> { return [...this.kayitlar] }

  async ekle(_ctx: TenantCtx, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    this.cakismaKontrol(girdi.kod)
    const kayit: Tedarikci = { id: `ted-${++this.sayac}`, aktif: true, ...girdi }
    this.kayitlar.push(kayit)
    return kayit
  }

  async guncelle(_ctx: TenantCtx, id: string, girdi: TedarikciGirdisi): Promise<Tedarikci> {
    this.cakismaKontrol(girdi.kod, id)
    const mevcut = this.bul(id)
    const guncel = { ...mevcut, ...girdi }
    this.kayitlar = this.kayitlar.map(k => (k.id === id ? guncel : k))
    return guncel
  }

  async aktiflikDegistir(_ctx: TenantCtx, id: string, aktif: boolean): Promise<Tedarikci> {
    const guncel = { ...this.bul(id), aktif }
    this.kayitlar = this.kayitlar.map(k => (k.id === id ? guncel : k))
    return guncel
  }

  private bul(id: string): Tedarikci {
    const kayit = this.kayitlar.find(k => k.id === id)
    if(!kayit) throw new Error(`Tedarikçi bulunamadı: ${id}`)
    return kayit
  }

  private cakismaKontrol(kod: string, hariçId?: string){
    const anahtar = normalizeIdentifier(kod)
    if(this.kayitlar.some(k => k.id !== hariçId && normalizeIdentifier(k.kod) === anahtar)){
      throw new TedarikciKoduCakismasiError(kod)
    }
  }
}

let depo: BellekDeposu
let servis: TedarikciServisi

beforeEach(() => {
  depo = new BellekDeposu()
  servis = new TedarikciServisi(depo)
})

const temel: TedarikciGirdisi = { kod: 'ET-01', ad: 'Et Tedarik A.Ş.' }

describe('Tedarikçi · ekle', () => {
  it('kaydediyor ve aktif başlatıyor', async () => {
    const kayit = await servis.ekle(ctx, { ...temel, yetkili: 'Mehmet Bey', telefon: '0212 000 00 00' })

    expect(kayit.kod).toBe('ET-01')
    expect(kayit.ad).toBe('Et Tedarik A.Ş.')
    expect(kayit.yetkili).toBe('Mehmet Bey')
    expect(kayit.aktif).toBe(true)
  })

  it('baştaki ve sondaki boşlukları kırpıyor', async () => {
    const kayit = await servis.ekle(ctx, { kod: '  ET-01  ', ad: '  Et Tedarik  ' })
    expect(kayit.kod).toBe('ET-01')
    expect(kayit.ad).toBe('Et Tedarik')
  })

  it('boş alanlar undefined kalıyor — boş metin saklanmıyor', async () => {
    const kayit = await servis.ekle(ctx, { ...temel, telefon: '   ', not: '' })
    expect(kayit.telefon).toBeUndefined()
    expect(kayit.not).toBeUndefined()
  })

  it('kod zorunlu', async () => {
    await expect(servis.ekle(ctx, { kod: '  ', ad: 'Bir Firma' }))
      .rejects.toThrow(TedarikciDogrulamaError)
  })

  it('ad zorunlu', async () => {
    await expect(servis.ekle(ctx, { kod: 'X-1', ad: '   ' }))
      .rejects.toThrow(TedarikciDogrulamaError)
  })

  it('bozuk e-posta reddediliyor, doğrusu kabul ediliyor', async () => {
    await expect(servis.ekle(ctx, { ...temel, eposta: 'mehmet.firma.com' }))
      .rejects.toThrow(TedarikciDogrulamaError)

    const kayit = await servis.ekle(ctx, { ...temel, eposta: 'mehmet@firma.com' })
    expect(kayit.eposta).toBe('mehmet@firma.com')
  })

  it('aynı kod büyük/küçük harf ve boşluk farkıyla ikinci kez eklenemiyor', async () => {
    await servis.ekle(ctx, temel)
    // Bu ayrışma gerçek bir risk: aynı tedarikçi iki kayıt olursa toplamları
    // ayrışır ve geri çağırmada parti bulunamaz.
    await expect(servis.ekle(ctx, { kod: ' et-01 ', ad: 'ET TEDARİK' }))
      .rejects.toThrow(TedarikciKoduCakismasiError)
  })
})

describe('Tedarikçi · düzenle', () => {
  it('alanları güncelliyor, kimliği koruyor', async () => {
    const kayit = await servis.ekle(ctx, temel)
    const guncel = await servis.guncelle(ctx, kayit.id, {
      kod: 'ET-01', ad: 'Et Tedarik ve Gıda A.Ş.', telefon: '0212 111 11 11',
    })

    expect(guncel.id).toBe(kayit.id)
    expect(guncel.ad).toBe('Et Tedarik ve Gıda A.Ş.')
    expect(guncel.telefon).toBe('0212 111 11 11')
  })

  it('kendi kodunu koruyarak güncelleyebiliyor — kendisiyle çakışmıyor', async () => {
    const kayit = await servis.ekle(ctx, temel)
    await expect(servis.guncelle(ctx, kayit.id, { kod: 'ET-01', ad: 'Yeni Ad' }))
      .resolves.toBeTruthy()
  })

  it('başka bir tedarikçinin koduna geçemiyor', async () => {
    await servis.ekle(ctx, temel)
    const ikinci = await servis.ekle(ctx, { kod: 'SUT-01', ad: 'Süt Tedarik' })

    await expect(servis.guncelle(ctx, ikinci.id, { kod: 'ET-01', ad: 'Süt Tedarik' }))
      .rejects.toThrow(TedarikciKoduCakismasiError)
  })
})

describe('Tedarikçi · pasife alma', () => {
  it('pasife alınıyor ve geri açılabiliyor — kayıt silinmiyor', async () => {
    const kayit = await servis.ekle(ctx, temel)

    const pasif = await servis.aktiflikDegistir(ctx, kayit.id, false)
    expect(pasif.aktif).toBe(false)
    // Kayıt duruyor: geçmiş partiler bu tedarikçiye bağlı kalmalı, yoksa geri
    // çağırma zinciri kopar.
    expect((await servis.hepsi(ctx)).map(t => t.id)).toContain(kayit.id)

    const tekrarAktif = await servis.aktiflikDegistir(ctx, kayit.id, true)
    expect(tekrarAktif.aktif).toBe(true)
  })
})

describe('Tedarikçi · liste süzgeci', () => {
  const liste: Tedarikci[] = [
    { id: '1', kod: 'ET-01', ad: 'Et Tedarik', yetkili: 'Mehmet Bey', aktif: true },
    { id: '2', kod: 'SUT-01', ad: 'Süt Gıda', yetkili: 'Ayşe Hanım', aktif: true },
    { id: '3', kod: 'UN-01', ad: 'Un Fabrikası', aktif: false },
  ]

  it('varsayılan olarak pasifler gizli', () => {
    expect(tedarikcileriSuz(liste, '', false).map(t => t.id)).toEqual(['1', '2'])
  })

  it('istenirse pasifler de görünüyor', () => {
    expect(tedarikcileriSuz(liste, '', true).map(t => t.id)).toEqual(['1', '2', '3'])
  })

  it('koda, ada ve yetkiliye göre arıyor', () => {
    expect(tedarikcileriSuz(liste, 'SUT', false).map(t => t.id)).toEqual(['2'])
    expect(tedarikcileriSuz(liste, 'süt', false).map(t => t.id)).toEqual(['2'])
    // Depo sorumlusu tedarikçiyi kodla değil, kişiyle hatırlar.
    expect(tedarikcileriSuz(liste, 'mehmet', false).map(t => t.id)).toEqual(['1'])
  })

  it('Türkçe i/I farkı aramayı bozmuyor', () => {
    // 'Tedarik' içindeki i ile aranan 'TEDARİK' içindeki İ aynı sayılmalı.
    expect(tedarikcileriSuz(liste, 'TEDARİK', false).map(t => t.id)).toEqual(['1'])
  })
})
