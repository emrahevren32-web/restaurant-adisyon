// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — ZİLDEKİ SATIR BİR YERE GÖTÜRMELİ
//
// Emrah: *"önceden bildirim gelince tıklardım, ilgili sayfaya yönlendirirdi
// beni; şimdi öyle olmuyor."*
//
// Sebep: `openEvren360NotificationTarget` yalnız `business_application`
// türünü ele alıyordu. Zilde görünen satırların çoğu `license_expiry`
// (lisans süresi bitiyor) ve onlar sessizce hiçbir şey yapmıyordu.
//
// ⚠️ Bu, "yoksa yoktur" değil, "varmış gibi yapıyor" durumudur: satır
// tıklanabilir görünüyor, imleç değişiyor, okundu işaretleniyor — ama
// hiçbir yere gitmiyor. Emrah'ın kuralı: ortaya koyduğumuz şey çalışsın,
// mış gibi yapmasın.
//
// Bu test, zilin ürettiği HER tür için ya bir hedef ya da yazılı bir
// gerekçe olmasını zorluyor.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const oku = (...parcalar: string[]) =>
  readFileSync(join(process.cwd(), ...parcalar), 'utf8')

const APP = oku('src', 'App.tsx')

/** Zilin ürettiği bildirim türleri ve her birinin durumu. */
const TURLER: Array<{ tur: string; hedef: 'var' | 'gerekce' }> = [
  { tur: 'business_application', hedef: 'var' },     // Bekleyen Başvurular
  { tur: 'license_expiry',       hedef: 'var' },     // Müşteri Detayı
  { tur: 'support_request',      hedef: 'gerekce' }  // ekran henüz yok
]

describe('zil yönlendirmesi', () => {
  it('sağlama: yönlendirme fonksiyonu okundu', () => {
    expect(APP).toContain('const openEvren360NotificationTarget')
  })

  const govde = () => {
    const bas = APP.indexOf('const openEvren360NotificationTarget')
    const son = APP.indexOf('\n  const ', bas + 10)
    return APP.slice(bas, son > bas ? son : bas + 2500)
  }

  it('her tür ya bir hedefe gidiyor ya yazılı gerekçesi var', () => {
    const g = govde()
    for(const { tur, hedef } of TURLER){
      expect(g, `${tur} yönlendirmede hiç geçmiyor`).toContain(tur)
      if(hedef === 'var'){
        // Türün geçtiği yerden sonra bir rota/ekran çağrısı olmalı.
        const parca = g.slice(g.indexOf(tur))
        expect(
          /setRoute\(|openCustomerDetail\(/.test(parca.slice(0, 500)),
          `${tur} için hedef ekran çağrısı yok`
        ).toBe(true)
      }
    }
  })

  it('lisans satırı Müşteri Detayı ekranına gidiyor', () => {
    // `targetId` kiracı kimliğidir (lisans-bildirimleri.ts), Müşteri
    // Detayı ekranının beklediği şey de odur.
    const g = govde()
    expect(g).toContain("notification.type === 'license_expiry'")
    expect(g).toContain('openCustomerDetail(notification.targetId)')
  })

  it('hedefi olmayan tür için uydurma rota YOK', () => {
    const g = govde()
    // Yazılı gerekçe şart: sessiz `return` bırakmak, bir sonraki kişiyi
    // "burada bir hata var mı" sorusuyla baş başa bırakır.
    expect(g).toContain('support_request')
    expect(g).toMatch(/HENÜZ YOK|henüz yok/)
  })

  it('lisans bildirimi kiracı kimliğini taşımaya devam ediyor', () => {
    const lisans = oku('src', 'notifications', 'lisans-bildirimleri.ts')
    expect(lisans).toContain('targetId: l.tenantId')
    expect(lisans).toContain("type: 'license_expiry'")
  })
})
