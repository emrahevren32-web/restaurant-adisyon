// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Son onay — ekranın karar verdiği TEK şey: düğme neden kapalı
//
// ⚠️ KURALIN KENDİSİ burada sınanmıyor (müdür mü, sahip mi, işletmede müdür
// var mı): o `db/prova/prova-0117.sql` içinde, `authenticated` rolüyle,
// gerçek UPDATE yoluyla ölçülüyor. Onu burada taklit etmek, taklidin yeşil
// kalıp sunucunun kırmızı olmasına izin verirdi.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  SON_ONAY_KURALI, SON_ONAY_OKUNAMADI, SON_ONAY_YETKISI_YOK, sonOnayKapaliSebebi,
} from './son-onay'

const OZET = 'Eksik onay: Depo — hammadde yeterli mi'

describe('"Onaylandı" düğmesi neden kapalı', () => {
  it('yetki var + zincir tamam → AÇIK', () => {
    expect(sonOnayKapaliSebebi(true, true, OZET)).toBeUndefined()
  })

  it('yetki var + zincir eksik → zincirin kendi cümlesi', () => {
    expect(sonOnayKapaliSebebi(true, false, OZET)).toBe(OZET)
  })

  it('⚠️ yetki YOKSA zincir tamam olsa da KAPALI', () => {
    expect(sonOnayKapaliSebebi(false, true, OZET)).toBe(SON_ONAY_YETKISI_YOK)
  })

  it('⚠️ yetki yok + zincir eksik → ÖNCE yetki söylenir (veritabanıyla aynı sıra)', () => {
    // "Şu adım eksik" demek, adım tamamlanınca düğmenin açılacağını sandırır.
    expect(sonOnayKapaliSebebi(false, false, OZET)).toBe(SON_ONAY_YETKISI_YOK)
  })

  it('⚠️ yetki OKUNAMADIYSA kapalı — ve "veremezsiniz" DENMİYOR', () => {
    expect(sonOnayKapaliSebebi(null, true, OZET)).toBe(SON_ONAY_OKUNAMADI)
    expect(SON_ONAY_OKUNAMADI).not.toContain('veremez')
  })

  it('yetkisiz cümlesi KURALI söylüyor (kime gidileceği yazılı)', () => {
    expect(SON_ONAY_YETKISI_YOK).toContain(SON_ONAY_KURALI)
    expect(SON_ONAY_KURALI).toContain('İşletme Müdürü')
    expect(SON_ONAY_KURALI).toContain('işletme sahibi')
  })
})
