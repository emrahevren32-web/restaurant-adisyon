// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ÇAĞRILAN HER RPC `public` ŞEMASINDA OLMALI (mimari testi)
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// Supabase'in REST katmanı (PostgREST) YALNIZCA `public` şemasındaki
// fonksiyonları yayınlar. `app` şemasına konan bir fonksiyon tarayıcıdan
// çağrılamaz — ve bunu ancak CANLIDA öğrenirsin:
//
//   "Could not find the function public.basvuru_gonder(...) in the
//    schema cache"
//
// Bu hata bu depoda İKİ KEZ oldu:
//   · 0012 politika RPC'sini `app`'e koydu → 0016 düzeltti
//   · 0033 `basvuru_gonder`'ı `app`'e koydu → 0034 düzeltti
//
// İkinci kez olması, dersin yazılı olmasının yetmediğini gösteriyor. Bu
// yüzden kural artık bir test: koddan `.rpc('ad')` ile çağrılan her
// fonksiyonun göçlerde `public` şemasında YARATILDIĞI doğrulanıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gocMetni, projeKokunuBul } from '../core/test-support/goc-tarama'

const kok = projeKokunuBul()

/** src altındaki bütün TypeScript dosyaları. */
const kaynakDosyalar = (dizin: string, toplanan: string[] = []): string[] => {
  for(const ad of readdirSync(dizin) as string[]){
    const yol = join(dizin, ad)
    if(statSync(yol).isDirectory()){
      if(ad === 'node_modules' || ad.startsWith('.')) continue
      kaynakDosyalar(yol, toplanan)
    } else if(/\.tsx?$/.test(ad) && !/\.test\.tsx?$/.test(ad)){
      // ⚠️ Test dosyaları HARİÇ. Sebep somut: bu dosyanın kendi yorumunda
      // `.rpc('ad')` örneği geçiyor ve tarayıcı onu gerçek bir çağrı sandı —
      // test kendi kendini yakaladı. Ayrıca testler tarayıcıda koşmuyor,
      // gerçek bir RPC çağrısı yapmıyorlar.
      toplanan.push(yol)
    }
  }
  return toplanan
}

/**
 * Taranacak dizinler.
 *
 * ⚠️ `supabase/functions` SONRADAN EKLENDİ ve sebebi somut: 0039'un Edge
 * Function'ını yazarken çağrıyı önce `app` şemasına yapmıştım. Bu test
 * yalnız `src` altına baktığı için görmezdi — kural vardı, kapsamı eksikti.
 * Bir kuralın kapsamı, korumak istediği YERLERİN tamamı olmalı.
 */
const TARANAN_DIZINLER = ['src', 'supabase/functions']

/** Koddan `.rpc('ad'` biçiminde çağrılan fonksiyon adları. */
const cagrilanRpcler = (): Map<string, string[]> => {
  const bulunan = new Map<string, string[]>()
  const dosyalar = TARANAN_DIZINLER.flatMap(d => {
    const yol = join(kok, d)
    try { return kaynakDosyalar(yol) } catch { return [] as string[] }
  })
  for(const yol of dosyalar){
    const metin = readFileSync(yol, 'utf8') as string
    const re = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g
    let m: RegExpExecArray | null
    while((m = re.exec(metin)) !== null){
      const liste = bulunan.get(m[1]) ?? []
      liste.push(yol.replace(`${kok}/`, ''))
      bulunan.set(m[1], liste)
    }
  }
  return bulunan
}

const sql = gocMetni()

/** Göçlerde `public` şemasında yaratılan fonksiyon adları. */
const publicFonksiyonlar = (): Set<string> => {
  const adlar = new Set<string>()
  const re = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi
  let m: RegExpExecArray | null
  while((m = re.exec(sql)) !== null) adlar.add(m[1].toLowerCase())
  return adlar
}

describe('Tarama gerçekten çalışıyor', () => {
  it('kaynak ağacında dosya buluyor', () => {
    expect(kaynakDosyalar(join(kok, 'src')).length).toBeGreaterThan(100)
  })

  it('test dosyaları taramaya girmiyor', () => {
    const testler = kaynakDosyalar(join(kok, 'src')).filter(y => /\.test\.tsx?$/.test(y))
    expect(testler).toEqual([])
  })

  it('göçlerde public fonksiyon buluyor', () => {
    const adlar = [...publicFonksiyonlar()]
    expect(adlar.length).toBeGreaterThanOrEqual(2)
    // 0016'nın düzelttiği fonksiyon: kalıbın kendisi.
    expect(adlar).toContain('set_negative_stock_policy')
  })
})

describe('Çağrılan her RPC public şemasında', () => {
  it('koddan çağrılan fonksiyonların hepsi göçlerde public olarak var', () => {
    const cagrilan = cagrilanRpcler()
    const publicler = publicFonksiyonlar()
    const eksik: string[] = []

    for(const [ad, dosyalar] of cagrilan){
      if(!publicler.has(ad.toLowerCase())){
        eksik.push(`${ad} (çağıran: ${dosyalar.join(', ')})`)
      }
    }

    // Hata mesajı doğrudan çözümü söylüyor: geliştirici "neden" diye
    // aramak zorunda kalmasın.
    expect(
      eksik,
      'Bu fonksiyonlar koddan çağrılıyor ama göçlerde `public` şemasında ' +
      'yaratılmamış. PostgREST yalnız `public`i yayınlar; `app` şemasındaki ' +
      'fonksiyon tarayıcıdan ÇAĞRILAMAZ (bkz. 0016 ve 0034).',
    ).toEqual([])
  })

  it('başvuru gönderme fonksiyonu gerçekten aranıyor — test boşa geçmesin', () => {
    // Bu iddia olmasa, `.rpc(` hiç bulunamazsa test sessizce geçerdi.
    expect([...cagrilanRpcler().keys()]).toContain('basvuru_gonder')
  })
})
