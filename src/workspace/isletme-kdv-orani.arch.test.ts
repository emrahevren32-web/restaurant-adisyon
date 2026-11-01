// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — İŞLETME GENELİ KDV ORANI BİR İŞE YARIYOR
//
// ── NEDEN VAR (02.11.2026 · HEDEFLER 3.4.7) ──────────────────────────────
// 0103 `tenant_settings.vat_rate` kolonunu açtı ve İşletme Ayarları ekranı
// onu yazıyordu. 01.11'de ölçüldü: değer **hiçbir yerde kullanılmıyordu.**
// Ekran yalan söylemiyordu ama VERİLMEMİŞ BİR SÖZÜN BEKLENTİSİNİ
// doğuruyordu — kullanıcı bir oran giriyor ve hiçbir şey olmuyor.
//
// Göç 0105 borcu kapattı: oran, KDV alanı boş bırakılan YENİ ürün kartına
// kopyalanıyor. Bu sınama o kuralın sessizce geri düşmesini engelliyor.
//
// ── NEYİ ÖLÇÜYOR, NEYİ ÖLÇMÜYOR ──────────────────────────────────────────
// ⚠️ Davranışı ölçmüyor — onu `db/prova/prova-0105.sql` (13 ölçüm) ve
// `prova-0105-ters.sql` (4 ölçüm) gerçek PostgreSQL'de ölçtü.
// Buradaki iş KURALIN VARLIĞINI ve EKRANIN DOĞRU SÖYLEMESİNİ dondurmak:
// göç dosyası silinirse ya da ekran metni eski "hiçbir işe yaramıyor"
// hâline dönerse kırmızı verir.
//
// ⚠️ Metin ararken satır sonları düzleştiriliyor (tuzak 133): JSX'te bir
// cümle iki satıra bölünmüş olabilir ve kendi yazdığım metni bulamam.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gocMetni, projeKokunuBul } from '../core/test-support/goc-tarama'

const KOK = projeKokunuBul()
const oku = (ad: string) => readFileSync(join(KOK, ad), 'utf8') as string
const duz = (metin: string) => metin.replace(/\s+/g, ' ')

const GOCLER = gocMetni()
const AYARLAR = oku('src/pages/Settings.tsx')
const DEPO = oku('src/pages/Warehouse.tsx')

describe('İşletme geneli KDV oranı kullanılıyor', () => {
  it('⚠️ oranı ürün kartına taşıyan bir tetik VAR', () => {
    expect(
      duz(GOCLER),
      'stock_item üzerinde KDV tetiği yok: işletme geneli oran yeniden '
      + 'hiçbir işe yaramayan bir alana döndü (HEDEFLER 3.4.7).'
    ).toMatch(/create trigger stock_item_kdv/i)
  })

  it('tetik fonksiyonu tenant_settings.vat_rate OKUYOR', () => {
    const govde = duz(GOCLER)
    expect(govde).toMatch(/create or replace function app\.urun_kdv_isletmeden/i)
    expect(
      govde,
      'fonksiyon işletme ayarını okumuyorsa kopyalayacağı bir şey yok'
    ).toMatch(/select ts\.vat_rate into new\.vat_rate/i)
  })

  it('⚠️ tetik BEFORE INSERT · UPDATE\'i KAPSAMIYOR', () => {
    // UPDATE'i de kapsasaydı, kullanıcının BİLEREK sildiği oranı geri
    // yazardı — kararını ezmek olurdu. 0052'nin tetiği de yalnız INSERT.
    const kesit = duz(GOCLER).match(/create trigger stock_item_kdv[^;]*/i)?.[0] ?? ''
    expect(kesit).toMatch(/before insert on public\.stock_item/i)
    expect(
      kesit,
      'tetik UPDATE de kapsıyor: kullanıcının sildiği oran geri yazılır'
    ).not.toMatch(/update/i)
  })

  it('⚠️ İşletme Ayarları ekranı artık "hiçbir yerde kullanılmıyor" DEMİYOR', () => {
    expect(
      duz(AYARLAR),
      'Ekran hâlâ borcu itiraf ediyor; oysa 0105 o borcu kapattı.'
    ).not.toMatch(/Bu oran şu an yalnızca burada saklanıyor/)
  })

  it('İşletme Ayarları ekranı YENİ kartlara geçtiğini söylüyor', () => {
    expect(duz(AYARLAR)).toMatch(/yeni ürün kartlarına varsayılan olarak geçer/i)
  })

  it('⚠️ ekran MEVCUT ürünlerin değişmediğini de söylüyor', () => {
    // Bunu yazmazsak kullanıcı oranı değiştirip bütün ürünlerin
    // değiştiğini sanır — ekranın veremediği bir söz.
    expect(
      duz(AYARLAR),
      'Sınırı söylemeyen bir söz, verilmemiş bir söz gibi anlaşılır.'
    ).toMatch(/Mevcut ürünler değişmez/i)
  })

  it('ürün kartı, boş bırakılırsa ne olacağını söylüyor', () => {
    expect(
      duz(DEPO),
      'Depo ekranındaki KDV alanı, boş bırakmanın sonucunu anlatmıyor.'
    ).toMatch(/Boş bırakırsanız İşletme Ayarları.{0,3}ndaki oran kullanılır/i)
  })
})
