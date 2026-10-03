// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C — SİPARİŞ BİLDİRİMLERİ (firmaya, kontrol panelinde)
//
// Yol haritası maddesi: "Firmaya bildirim"
//          Bitti sayılır ki: "Sipariş güncellendiğinde firma anında görüyor"
//
// ── NİÇİN ─────────────────────────────────────────────────────────────────
// Portal açıldı: müşteri artık kendi kendine sipariş giriyor. Kimsenin
// bakmadığı bir kutuda biriken sipariş, alınmamış siparişten kötüdür —
// çünkü müşteri verdiğini sanıyor.
//
// ⚠️ SATIRLAR SAKLANMIYOR, DEFTERDEN TÜRETİLİYOR (lisans ve başvuru
// bildirimleriyle aynı ilke). Saklanan bildirim, gerçeklikle senkron
// kalmadığı gün yalan söyler: onaylanmış bir sipariş ekranda "onay bekliyor"
// diye durmaya devam eder.
// ═══════════════════════════════════════════════════════════════════════════

import type { Fark, Siparis } from '../sales/sales-order.repository'

export type SiparisBildirimi = {
  id: string
  baslik: string
  ayrinti: string
  aciliyet: 'kritik' | 'uyari'
  siparisId: string
}

/** Teslim tarihine bu kadar gün kalan onaysız sipariş KRİTİK sayılır. */
export const ONAY_ACELE_GUNU = 2

const gunFarki = (tarih: string, bugun: string): number => {
  const g = 86400000
  return Math.round(
    (new Date(`${tarih}T00:00:00`).getTime() - new Date(`${bugun}T00:00:00`).getTime()) / g,
  )
}

const kimden = (s: Siparis) => [s.musteriAdi, s.noktaAdi].filter(Boolean).join(' · ') || '—'

/**
 * Siparişler ve farklar → kontrol panelindeki "dikkat" satırları.
 *
 * Saf fonksiyon: ağ yok, saat yok. `bugun` dışarıdan veriliyor ki test
 * takvime bağlı olmasın — saati içeride okuyan bir fonksiyon, gece yarısı
 * farklı sonuç veren bir testtir.
 */
export const siparisBildirimleri = (
  siparisler: readonly Siparis[],
  farklar: readonly Fark[],
  bugun: string,
): SiparisBildirimi[] => {
  const satirlar: SiparisBildirimi[] = []

  for(const s of siparisler){
    if(s.durum !== 'Onay Bekliyor') continue

    // Teslim tarihi yaklaşmış ya da geçmiş bir onaysız sipariş, artık
    // "bekleyen iş" değil KAÇIRILMAK ÜZERE OLAN iştir.
    const hedef = s.teslimTarihi ?? s.sevkTarihi
    const kalan = hedef ? gunFarki(hedef, bugun) : undefined
    const acele = kalan !== undefined && kalan <= ONAY_ACELE_GUNU

    satirlar.push({
      id: `siparis_onay_${s.id}`,
      baslik: 'Sipariş onay bekliyor',
      ayrinti: [
        `${s.siparisNo} · ${kimden(s)}`,
        kalan === undefined ? null
          : kalan < 0 ? `teslim tarihi ${Math.abs(kalan)} gün GEÇTİ`
          : kalan === 0 ? 'teslim BUGÜN'
          : `teslime ${kalan} gün`,
        // Revizyon 1'den büyükse bu sipariş onaylanmışken DEĞİŞTİ ve
        // zincire geri döndü (0055). Yeni bir siparişten farklı bir iştir.
        s.guncelRevizyon > 1 ? `revizyon ${s.guncelRevizyon} — onaylar düştü` : null,
      ].filter(Boolean).join(' · '),
      aciliyet: acele ? 'kritik' : 'uyari',
      siparisId: s.id,
    })
  }

  for(const f of farklar){
    if(f.durum === 'Karara Bağlandı') continue
    satirlar.push({
      id: `siparis_fark_${f.id}`,
      baslik: f.durum === 'Açık' ? 'Fark kaydı açık' : 'Fark incelemede',
      ayrinti: [
        `${f.tur}${f.kalemAdi ? ` · ${f.kalemAdi}` : ''}`,
        f.miktar !== undefined ? `${f.miktar.toLocaleString('tr-TR')} ${f.birim ?? ''}`.trim() : null,
        f.aciklama,
      ].filter(Boolean).join(' · '),
      // Açık bir fark her zaman kritiktir: birisi bayrağı kaldırdı ve
      // kimse bakmadı demektir.
      aciliyet: f.durum === 'Açık' ? 'kritik' : 'uyari',
      siparisId: f.siparisId,
    })
  }

  // Kritikler önce; aynı aciliyette sipariş numarası/ayrıntı sırasıyla.
  const sira = { kritik: 0, uyari: 1 } as const
  return satirlar.sort((a, b) =>
    sira[a.aciliyet] - sira[b.aciliyet] || a.ayrinti.localeCompare(b.ayrinti, 'tr'))
}

/** Kontrol panelindeki tek cümlelik özet. */
export const siparisOzeti = (satirlar: readonly SiparisBildirimi[]): string => {
  if(satirlar.length === 0) return 'Bekleyen sipariş işi yok.'
  const onay = satirlar.filter(s => s.id.startsWith('siparis_onay_')).length
  const fark = satirlar.filter(s => s.id.startsWith('siparis_fark_')).length
  return [
    onay > 0 ? `${onay} sipariş onay bekliyor` : null,
    fark > 0 ? `${fark} fark kaydı açık` : null,
  ].filter(Boolean).join(' · ')
}
