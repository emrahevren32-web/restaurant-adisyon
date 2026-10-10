// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Tekerlek zinciri testleri
//
// Kararı veren iki kural saf fonksiyon: "bu kutu dikey kayabilir mi" ve
// "bu kutu yatay tuzak mı". Tarayıcıdaki davranışı ayrıca Chromium'da
// ölçtüm (8/8); burada korunan şey KURALIN kendisi:
//
//   · dikey kayabilen bir kutuya ASLA karışmamak (yan menü, bildirim
//     listesi bozulursa kullanıcı bunu hemen hisseder)
//   · 1 pikselllik kenarlık taşmasını "kaydırılabilir" saymamak
//   · kutunun dibine/tepesine gelindiğinde bırakmak
// ═══════════════════════════════════════════════════════════════════════════
import { describe, expect, it } from 'vitest'
import {
  KAYDIRAN_TASMALAR,
  dikeyKaydirabilir,
  tekerlekPiksele,
  yatayTuzak,
  type KutuOlcusu,
} from './tekerlek-zinciri'

const kutu = (y: Partial<KutuOlcusu> = {}): KutuOlcusu => ({
  tasmaX: 'visible',
  tasmaY: 'visible',
  kaydirmaUstu: 0,
  kaydirmaYuksekligi: 100,
  gorunenYukseklik: 100,
  kaydirmaGenisligi: 100,
  gorunenGenislik: 100,
  ...y,
})

describe('dikeyKaydirabilir', () => {
  it('taşma değeri kaydırma kabı yapmıyorsa hayır der', () => {
    for (const tasma of ['visible', 'hidden', 'clip']) {
      expect(dikeyKaydirabilir(
        kutu({ tasmaY: tasma, kaydirmaYuksekligi: 500 }), 100,
      )).toBe(false)
    }
  })

  it('auto ve scroll kaydırma kabı sayılır', () => {
    for (const tasma of ['auto', 'scroll']) {
      expect(dikeyKaydirabilir(
        kutu({ tasmaY: tasma, kaydirmaYuksekligi: 500 }), 100,
      )).toBe(true)
    }
  })

  it('1 pikselllik taşmayı kaydırılabilir saymaz', () => {
    // ⚠️ Bu test olmasa her kenarlıklı tablo "kayabilir" görünür ve
    // zincir hiç devreye girmezdi.
    expect(dikeyKaydirabilir(
      kutu({ tasmaY: 'auto', kaydirmaYuksekligi: 101 }), 100,
    )).toBe(false)
  })

  it('dibe gelindiğinde aşağı için hayır der', () => {
    expect(dikeyKaydirabilir(
      kutu({ tasmaY: 'auto', kaydirmaYuksekligi: 500, kaydirmaUstu: 400 }), 100,
    )).toBe(false)
  })

  it('dipteyken yukarı için evet der', () => {
    expect(dikeyKaydirabilir(
      kutu({ tasmaY: 'auto', kaydirmaYuksekligi: 500, kaydirmaUstu: 400 }), -100,
    )).toBe(true)
  })

  it('tepedeyken yukarı için hayır der', () => {
    expect(dikeyKaydirabilir(
      kutu({ tasmaY: 'auto', kaydirmaYuksekligi: 500, kaydirmaUstu: 0 }), -100,
    )).toBe(false)
  })

  it('ortadayken iki yöne de evet der', () => {
    const o = kutu({ tasmaY: 'auto', kaydirmaYuksekligi: 500, kaydirmaUstu: 200 })
    expect(dikeyKaydirabilir(o, 100)).toBe(true)
    expect(dikeyKaydirabilir(o, -100)).toBe(true)
  })
})

describe('yatayTuzak', () => {
  it('yatay taşma varsa ve kap yatay kaydırıyorsa tuzaktır', () => {
    expect(yatayTuzak(kutu({ tasmaX: 'auto', kaydirmaGenisligi: 1400 }))).toBe(true)
  })

  it('yatay taşma yoksa tuzak değildir', () => {
    // Tarayıcı zaten sayfayı kaydırıyor; karışmak gereksiz.
    expect(yatayTuzak(kutu({ tasmaX: 'auto', kaydirmaGenisligi: 100 }))).toBe(false)
  })

  it('1 pikselllik yatay taşma tuzak sayılmaz', () => {
    expect(yatayTuzak(kutu({ tasmaX: 'auto', kaydirmaGenisligi: 101 }))).toBe(false)
  })

  it('yatay eksen kapalıysa tuzak değildir', () => {
    for (const tasma of ['visible', 'hidden', 'clip']) {
      expect(yatayTuzak(kutu({ tasmaX: tasma, kaydirmaGenisligi: 1400 }))).toBe(false)
    }
  })
})

describe('tekerlekPiksele', () => {
  it('piksel biriminde geleni olduğu gibi bırakır', () => {
    expect(tekerlekPiksele(120, 0, 600)).toBe(120)
  })

  it('satır birimini piksele çevirir', () => {
    expect(tekerlekPiksele(3, 1, 600)).toBe(48)
  })

  it('sayfa birimini görünen yüksekliğe çevirir', () => {
    expect(tekerlekPiksele(1, 2, 600)).toBe(600)
  })

  it('yukarı yönde işareti korur', () => {
    expect(tekerlekPiksele(-3, 1, 600)).toBe(-48)
  })
})

describe('KAYDIRAN_TASMALAR', () => {
  it('clip ve hidden listede olmamalı', () => {
    // ⚠️ Biri buraya `hidden` eklerse zincir, dikey kayamayan kutuları
    // "kayabilir" sayıp hiç devreye girmez olur.
    expect(KAYDIRAN_TASMALAR.has('hidden')).toBe(false)
    expect(KAYDIRAN_TASMALAR.has('clip')).toBe(false)
    expect(KAYDIRAN_TASMALAR.has('visible')).toBe(false)
  })
})
