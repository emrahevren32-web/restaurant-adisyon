// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Ekranın kiracı bağlamı
//
// `TenantCtx` üç kimlik taşır: tenant, şube, kullanıcı. Depo ekranı Postgres'e
// konuştuğu için bu üçü de POSTGRES kimlikleri olmalıdır — localStorage'daki
// `branch_merkez` gibi eski demo kimlikleri burada işe yaramaz, yabancı anahtar
// hatası verir.
//
// ── NEDEN `tenant_id`'yi KULLANICI NESNESİNDEN ALMIYORUZ ──────────────────
// Tarayıcıdaki `User` nesnesi düzenlenebilir. Oradan okunan bir `tenantId`,
// başka bir kiracının kimliğiyle değiştirilebilirdi. Bunun bir zarar vermemesi
// RLS sayesinde zaten garanti (yazarken `tenant_id` JWT ile karşılaştırılır),
// ama yanlış bir değerle çalışmak "neden hiçbir şey görünmüyor" diye saatler
// kaybettirir. Bu yüzden değeri VERİTABANINDAN okuyoruz: `tenant` tablosunda
// RLS zaten yalnızca kendi satırını gösteriyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type Sube = { id: string; kod: string; ad: string; merkez: boolean }

export type DepoBaglami = {
  ctx: TenantCtx
  subeler: Sube[]
}

/**
 * Oturum açmış kullanıcı için depo bağlamını kurar.
 *
 * Hatalar sessizce yutulmuyor: bir şey eksikse ne eksik olduğu ve nereye
 * bakılacağı yazılıyor. "Depo ekranı boş" demek, sebebini aramakla geçen bir
 * saat demektir.
 */
export const depoBaglamiKur = async (
  client: SupabaseClient,
  tercihEdilenSubeId?: string,
): Promise<DepoBaglami> => {
  const { data: kiraci, error: kiraciHatasi } = await client
    .from('tenant')
    .select('id, status')
    .limit(1)
    .maybeSingle()

  if(kiraciHatasi){
    throw new Error(
      `Kiracı bilgisi okunamadı: ${kiraciHatasi.message}. `
      + 'Oturum açık mı ve JWT hook etkin mi (db/migrations/0009)?',
    )
  }
  if(!kiraci){
    throw new Error(
      'Bu oturum için kiracı satırı görünmüyor. Genellikle JWT içinde `tenant_id` '
      + 'claim’i yok demektir — Supabase Dashboard → Authentication → Hooks '
      + 'altında "Customize Access Token" hook’unun ENABLED olduğunu doğrulayın '
      + '(bkz. docs/g7-kurulum.md ADIM 4).',
    )
  }

  // ── İŞLEMİ YAPAN KİŞİ OTURUMDAN ÇÖZÜLÜR ──────────────────────────────────
  // ⚠️ Burada bir zamanlar `.limit(1).maybeSingle()` vardı, filtresiz.
  // `app_user` politikası (0001) KİRACI yalıtımı yapıyor, kişi yalıtımı
  // DEĞİL: aynı işletmedeki herkes birbirini görür — görmesi de gerekir,
  // yetki ekranı o listeyi basıyor. Dolayısıyla filtresiz `limit(1)`
  // oturumu açan kişiyi değil, SIRADA İLK GELEN kişiyi seçiyordu.
  //
  // Sonucu şuydu: her stok hareketinin, her belgenin ve her denetim
  // kaydının "kim yaptı" alanı yanlış kişiyi gösterebiliyordu. MİYOP'un
  // sattığı şey tam olarak bu alan. Yanlış bir ad, hiç ad olmamasından
  // kötüdür: biri suçlanır ve kayıt onu doğruluyor görünür.
  //
  // ⚠️ KİMLİK ÇÖZÜLEMEZSE İŞLEM YAPILMAZ. Bir yedeğe düşmek — ilk kullanıcı,
  // "bilinmeyen", boş kimlik — defteri kirletmenin kibar yoludur.
  const { data: oturum, error: oturumHatasi } = await client.auth.getUser()
  const authKimligi = oturum?.user?.id

  if(oturumHatasi || !authKimligi){
    throw new Error(
      `Oturum kullanıcısı okunamadı: ${oturumHatasi?.message ?? 'oturum yok'}. `
      + 'İşlemi kimin yaptığı kesin bilinmeden depo işlemi yapılamaz; '
      + 'çıkış yapıp yeniden girin.',
    )
  }

  const { data: kullanici, error: kullaniciHatasi } = await client
    .from('app_user')
    .select('id, is_active')
    .eq('auth_user_id', authKimligi)
    .maybeSingle()

  if(kullaniciHatasi || !kullanici){
    throw new Error(
      `Kullanıcı kaydı okunamadı: ${kullaniciHatasi?.message ?? 'kayıt yok'}. `
      + '`app_user` tablosunda bu oturuma karşılık gelen bir satır olmalı '
      + '(auth_user_id üzerinden eşleşir — bkz. 0008).',
    )
  }

  // Pasife alınmış kullanıcının oturumu hâlâ açık olabilir: jeton kendi
  // ömrünü doldurana kadar yaşar. Defter yazımını burada durduruyoruz.
  if(kullanici.is_active === false){
    throw new Error(
      'Bu kullanıcı pasife alınmış. Depo işlemi yapılamaz; '
      + 'çıkış yapıp yetkiliyle görüşün.',
    )
  }

  const { data: subeSatirlari, error: subeHatasi } = await client
    .from('branch')
    .select('id, code, name, is_head_office')
    .order('is_head_office', { ascending: false })
    .order('name', { ascending: true })

  if(subeHatasi){
    throw new Error(`Şubeler okunamadı: ${subeHatasi.message}`)
  }

  const subeler: Sube[] = ((subeSatirlari as Array<{
    id: string; code: string; name: string; is_head_office: boolean
  }> | null) ?? []).map(satir => ({
    id: satir.id,
    kod: satir.code,
    ad: satir.name,
    merkez: satir.is_head_office,
  }))

  if(subeler.length === 0){
    throw new Error('Bu kiracıya ait hiç şube yok. Depo işlemi bir şubeye bağlı olmak zorunda.')
  }

  const secilen = subeler.find(sube => sube.id === tercihEdilenSubeId) ?? subeler[0]

  return {
    ctx: {
      tenantId: kiraci.id as string,
      branchId: secilen.id,
      userId: kullanici.id as string,
    },
    subeler,
  }
}
