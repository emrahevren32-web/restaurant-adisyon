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

  const { data: kullanici, error: kullaniciHatasi } = await client
    .from('app_user')
    .select('id')
    .limit(1)
    .maybeSingle()

  if(kullaniciHatasi || !kullanici){
    throw new Error(
      `Kullanıcı kaydı okunamadı: ${kullaniciHatasi?.message ?? 'kayıt yok'}. `
      + '`app_user` tablosunda bu oturuma karşılık gelen bir satır olmalı '
      + '(auth_user_id üzerinden eşleşir — bkz. 0008).',
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
