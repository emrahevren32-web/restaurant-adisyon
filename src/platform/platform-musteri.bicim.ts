// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · EVREN360 müşteri ekranlarının biçimlendirme yardımcıları
//
// ⚠️ TEK KURAL: BİLİNMEYENİ UYDURMA.
// Boş bir alan "—" olarak gösterilir, "0" ya da "Yok" olarak değil.
// "0 kullanıcı" ile "kullanıcı sayısını bilmiyoruz" aynı şey değildir ve
// platform sahibi bu ikisini karıştırırsa yanlış karar verir.
// ═══════════════════════════════════════════════════════════════════════════

import { DEFAULT_SECTORS } from '../sector/sector.registry'

export const BOS = '—'

export const bosDegilse = (deger: string | null | undefined) => (
  deger && String(deger).trim() ? String(deger).trim() : BOS
)

export const kisaTarih = (deger: string | null | undefined) => {
  if(!deger) return BOS
  const metin = String(deger)
  const t = new Date(metin.length === 10 ? `${metin}T12:00:00` : metin)
  return Number.isNaN(t.getTime()) ? BOS : t.toLocaleDateString('tr-TR')
}

export const tarihSaat = (deger: string | null | undefined) => {
  if(!deger) return BOS
  const t = new Date(String(deger))
  return Number.isNaN(t.getTime()) ? BOS : t.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

/** "3 gün önce" gibi. Boşsa "hiç" DEĞİL, "—": bilmiyoruz demek. */
export const zamanAraligi = (deger: string | null | undefined) => {
  if(!deger) return BOS
  const t = new Date(String(deger)).getTime()
  if(Number.isNaN(t)) return BOS

  const dakika = Math.floor((Date.now() - t) / 60000)
  if(dakika < 1) return 'az önce'
  if(dakika < 60) return `${dakika} dk önce`
  const saat = Math.floor(dakika / 60)
  if(saat < 24) return `${saat} saat önce`
  const gun = Math.floor(saat / 24)
  if(gun < 30) return `${gun} gün önce`
  const ay = Math.floor(gun / 30)
  if(ay < 12) return `${ay} ay önce`
  return `${Math.floor(ay / 12)} yıl önce`
}

export const gunFarkiMetni = (gun: number | null | undefined) => {
  if(gun === null || gun === undefined) return BOS
  if(gun < 0) return `${Math.abs(gun)} gün geçti`
  if(gun === 0) return 'bugün bitiyor'
  return `${gun} gün`
}

/**
 * Sektör kimliğini insan diline çevirir.
 *
 * ⚠️ İKİ AYRI YAZIM VAR ve ikisi de veritabanında duruyor:
 *   `company.primary_sector_id`      → 'sector_industrial_kitchen'
 *   `business_application.sector_code` → 'endustriyel-mutfak'
 * Eşleşme bulunamazsa ham kod gösteriliyor — sessizce "Genel" yazmak,
 * bilmediğimiz bir şeyi biliyormuş gibi göstermek olurdu.
 */
const SEKTOR_TAKMA_ADLARI: Record<string, string> = {
  'endustriyel-mutfak': 'Endüstriyel Mutfak',
  'endustriyel_mutfak': 'Endüstriyel Mutfak',
  'genel': 'Genel İşletme',
  'genel-isletme': 'Genel İşletme'
}

export const sektorAdi = (kod: string | null | undefined) => {
  const ham = String(kod ?? '').trim()
  if(!ham) return BOS

  const eslesme = DEFAULT_SECTORS.find(s => s.id === ham || s.code === ham)
  if(eslesme) return eslesme.name

  return SEKTOR_TAKMA_ADLARI[ham.toLocaleLowerCase('tr-TR')] ?? ham
}

/** Para: fiyat belirlenmediyse SAYI GÖSTERME. "0 ₺" bedava demektir. */
export const paraVeyaBelirsiz = (
  tutar: number | null | undefined,
  belirlendi: boolean
) => {
  if(!belirlendi) return 'Fiyat henüz belirlenmedi'
  if(tutar === null || tutar === undefined) return BOS
  return tutar.toLocaleString('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0
  })
}
