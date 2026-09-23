// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans — artık tarayıcıda değil, veritabanında (A4D madde 3)
//
// Eskiden lisans `localStorage`'da (`ra_company_licenses`) duruyordu:
// tarayıcı temizlenince kayboluyordu ve müşteri "lisansım yok" ekranında
// kalıyordu. Para alınacak gün ilk güvenilmesi gereken kayıt budur.
//
// ⚠️ BURADA KİRACI SÜZMESİ YOK — VE OLMAYACAK.
// `tenant_license` üzerinde RLS var (0042); sorguya `tenant_id = …` eklemek
// "filtre var, demek ki güvenli" yanılsaması doğurur ve RLS'in bir gün
// kapalı kaldığını fark etmemizi engeller (ADR-004).
//
// ⚠️ MÜŞTERİ KENDİ LİSANSINI DEĞİŞTİREMEZ. Bu dosyada yazma işlevi yoktur;
// veritabanında da `authenticated` rolüne insert/update verilmedi.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type LisansDurumu =
  | 'Deneme' | 'Aktif' | 'Süresi Doldu' | 'Askıya Alındı' | 'İptal Edildi'

export type Lisans = {
  anahtar: string
  paketKodu: string
  paketAdi: string
  aciklama: string
  durum: LisansDurumu
  baslangic: string
  bitis: string
  deneme: boolean
  moduller: string[]
}

type Satir = {
  license_key: string
  status: string
  start_date: string
  end_date: string
  is_trial: boolean
  package_id: string
  license_package: { code: string; name: string; description: string | null } | null
}

/**
 * Bitişe kaç gün kaldı?
 *
 * Saf fonksiyon: bugünü dışarıdan alır, böylece testte sabitlenebilir.
 * Gün farkı YEREL saatte değil, gün başlangıçlarına göre hesaplanıyor —
 * yoksa aynı gün içinde saate göre 0/1 arasında zıplıyor.
 */
export const kalanGun = (bitis: string, bugun: Date = new Date()): number => {
  const b = new Date(`${bitis}T00:00:00`)
  const g = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate())
  return Math.round((b.getTime() - g.getTime()) / 86_400_000)
}

/** Ekranda gösterilecek uyarı seviyesi. Eşikler tek yerde. */
export const lisansUyarisi = (
  lisans: Pick<Lisans, 'durum' | 'bitis'>,
  bugun: Date = new Date(),
): { seviye: 'iyi' | 'uyari' | 'kritik'; mesaj: string } => {
  const gun = kalanGun(lisans.bitis, bugun)

  if(lisans.durum === 'Süresi Doldu' || gun < 0){
    return { seviye: 'kritik', mesaj: 'Lisans süresi doldu. MİYOP ile iletişime geçin.' }
  }
  if(lisans.durum === 'Askıya Alındı'){
    return { seviye: 'kritik', mesaj: 'Lisans askıya alındı. MİYOP ile iletişime geçin.' }
  }
  if(lisans.durum === 'İptal Edildi'){
    return { seviye: 'kritik', mesaj: 'Lisans iptal edildi.' }
  }
  if(gun === 0) return { seviye: 'kritik', mesaj: 'Lisans bugün bitiyor.' }
  if(gun <= 7) return { seviye: 'kritik', mesaj: `Lisans ${gun} gün sonra bitiyor.` }
  if(gun <= 30) return { seviye: 'uyari', mesaj: `Lisans ${gun} gün sonra bitiyor.` }
  return { seviye: 'iyi', mesaj: `${gun} gün kaldı.` }
}

/**
 * Oturum açmış kullanıcının kiracısına ait yürürlükteki lisans.
 *
 * Yoksa `null` döner — uydurma bir lisans üretilmez. "Lisans görünmüyor"
 * demek, "lisans yok" demektir ve öyle görünmelidir.
 */
export const lisansiOku = async (client: SupabaseClient): Promise<Lisans | null> => {
  const { data, error } = await client
    .from('tenant_license')
    .select('license_key, status, start_date, end_date, is_trial, package_id, '
      + 'license_package ( code, name, description )')
    .in('status', ['Deneme', 'Aktif'])
    .limit(1)
    .maybeSingle()

  if(error) throw new Error(`Lisans okunamadı: ${error.message}`)
  if(!data) return null

  const satir = data as unknown as Satir
  const { data: modulSatirlari, error: modulHatasi } = await client
    .from('license_package_module')
    .select('module_key')
    .eq('package_id', satir.package_id)

  if(modulHatasi) throw new Error(`Paket modülleri okunamadı: ${modulHatasi.message}`)

  return {
    anahtar: satir.license_key,
    paketKodu: satir.license_package?.code ?? '',
    paketAdi: satir.license_package?.name ?? 'Paket',
    aciklama: satir.license_package?.description ?? '',
    durum: satir.status as LisansDurumu,
    baslangic: satir.start_date,
    bitis: satir.end_date,
    deneme: Boolean(satir.is_trial),
    moduller: ((modulSatirlari as { module_key: string }[] | null) ?? [])
      .map(m => m.module_key)
      .sort(),
  }
}
