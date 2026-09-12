// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Firma köprüsü — Postgres kimliği ile localStorage çalışma alanı arası
//
// ── BULUNAN HATA (2026-08-29) ─────────────────────────────────────────────
// Giriş Supabase Auth'a taşındıktan sonra `User.companyId` artık POSTGRES'teki
// `company.id` (bir uuid). Ama çalışma alanını şekillendiren kod hâlâ
// localStorage'a bakıyor:
//
//   getPrimarySectorIdForUser(user)
//     → loadCompanies().find(c => c.id === user.companyId)?.primarySectorId
//
// Bu uuid localStorage'daki `ra_companies` listesinde YOK (oradaki kayıtlar
// `company_1787…` biçiminde eski kimlikler). Dolayısıyla `find` boş dönüyor ve
// sektör `''` oluyor. Sonuç zinciri:
//
//   sektör ''  →  isBusinessWorkspaceModuleAvailableForSector() false
//              →  isWorkspaceNavigationBaseModule() false
//              →  hiçbir iş modülü menüde ÜRETİLMİYOR
//              →  ekranda "İş modülleri henüz kurulmadı" yazıyor
//
// Yani menü boşluğunun sebebi ADR-002'nin kapsam daraltması değil, iki kimlik
// dünyası arasındaki bu kopukluktu. Uzun süre fark edilmedi çünkü ikisi de
// tek başına doğru görünüyor.
//
// ── ÇÖZÜM ────────────────────────────────────────────────────────────────
// Girişten hemen sonra kullanıcının firmasını Postgres'ten okuyup localStorage
// modeline AYNALIYORUZ. Böylece mevcut (senkron) çalışma alanı mantığı tek
// satır değişmeden çalışır.
//
// Bu bilinçli olarak GEÇİCİ bir köprüdür. Doğru son hâl, çalışma alanı
// mantığının da firmayı doğrudan veritabanından okumasıdır; o, ekranların
// Postgres'e taşınmasıyla birlikte gelecek (ADR-003, dikey dilim). Köprü o güne
// kadar iki dünyayı tutarlı tutar ve kaldırılması tek dosyalık bir iştir.
//
// ⚠️ Kiracı süzmesini bu dosya YAPMAZ — RLS yapar (ADR-004). `company`
// tablosuna sorgu atarken `tenant_id` eşitliği EKLEMİYORUZ; eklersek "filtre
// var, demek ki güvenli" yanılsaması doğar ve RLS'in kapalı kalması fark
// edilmez.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { loadBranches, loadCompanies, saveBranches, saveCompanies } from '../storage'
import type { Branch, Company, User } from '../types'

type CompanySatiri = {
  id: string
  tenant_id: string
  company_code: string | null
  company_name: string | null
  primary_sector_id: string | null
  default_branch_id: string | null
  status: string | null
}

type BranchSatiri = {
  id: string
  tenant_id: string
  company_id: string
  code: string | null
  name: string | null
  branch_type: string | null
  is_active: boolean | null
  is_head_office: boolean | null
}

const metin = (deger: unknown): string => (typeof deger === 'string' ? deger.trim() : '')

/**
 * Şubeleri de aynalar.
 *
 * Başlıktaki "Yetkili şube yok" uyarısının sebebi buydu: şube listesi
 * localStorage'dan okunuyor ve orada Postgres'teki şubeler yok. Depo ekranı
 * şubesini doğrudan veritabanından çözdüğü için etkilenmiyordu, ama eski
 * ekranların tamamı ve başlıktaki şube seçici etkileniyordu.
 */
const subeleriAynala = async (firmaId: string): Promise<void> => {
  const { data, error } = await getSupabase()
    .from('branch')
    .select('id, tenant_id, company_id, code, name, branch_type, is_active, is_head_office')

  if(error || !data) return

  const satirlar = (data as BranchSatiri[]).filter(satir => satir.company_id === firmaId)
  if(satirlar.length === 0) return

  const mevcutlar = loadBranches()
  const aynalanan = new Map(satirlar.map(satir => [satir.id, satir]))

  const guncellenmis = mevcutlar.map(sube => {
    const satir = aynalanan.get(sube.id)
    if(!satir) return sube
    aynalanan.delete(sube.id)
    return { ...sube, ...subeyeCevir(satir, sube) }
  })

  const yeniler = [...aynalanan.values()].map(satir => subeyeCevir(satir))
  saveBranches([...guncellenmis, ...yeniler])
}

const subeyeCevir = (satir: BranchSatiri, varOlan?: Branch): Branch => ({
  ...(varOlan ?? {
    phone: '', email: '', address: '', city: '', managerName: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as Branch),
  id: satir.id,
  tenantId: satir.tenant_id,
  companyId: satir.company_id,
  code: metin(satir.code) || varOlan?.code || satir.id.slice(0, 8),
  name: metin(satir.name) || varOlan?.name || 'Şube',
  isActive: satir.is_active !== false,
  isHeadOffice: satir.is_head_office === true,
})

/**
 * Kullanıcının firmasını veritabanından okuyup localStorage modeline aynalar.
 *
 * Dönen değer, çözülen `primarySectorId`'dir (bulunamazsa `''`). Çağıran taraf
 * bunu yalnızca günlüğe/teşhise yazmak için kullanabilir; asıl etki yan etkidir.
 *
 * ── NEDEN HATA FIRLATMIYOR ───────────────────────────────────────────────
 * Bu bir kolaylık katmanı; başarısız olması GİRİŞİ engellememelidir. Supabase
 * yapılandırılmamışsa (yerel demo kullanımı) ya da sorgu düşerse kullanıcı
 * eskisi gibi içeri girer, yalnızca menü eskisi gibi dar kalır. Girişi buna
 * bağlamak, çevrimdışı bir ağ hatasını oturum açamama hâline çevirirdi.
 */
export const syncWorkspaceCompanyFromDatabase = async (user: User): Promise<string> => {
  if(!isSupabaseConfigured()) return ''

  try{
    const { data, error } = await getSupabase()
      .from('company')
      .select('id, tenant_id, company_code, company_name, primary_sector_id, default_branch_id, status')

    if(error || !data) return ''

    const satirlar = data as CompanySatiri[]
    if(satirlar.length === 0) return ''

    // Kullanıcının firması: kimliği eşleşen satır. Eşleşme yoksa ve RLS zaten
    // tek kiracıya indirdiği için tek satır kaldıysa onu kullanırız — kullanıcı
    // kaydında `company_id` boş kalmış olabilir.
    const satir = satirlar.find(item => item.id === user.companyId)
      ?? (satirlar.length === 1 ? satirlar[0] : undefined)
    if(!satir) return ''

    const sektor = metin(satir.primary_sector_id)

    const mevcutlar = loadCompanies({ allTenants: true })
    const varOlan = mevcutlar.find(item => item.id === satir.id)

    // Yalnızca veritabanının yetkili olduğu alanlar yazılır. Kullanıcının
    // ekrandan girdiği diğer alanlar (adres, telefon…) korunur — köprü onları
    // her girişte sıfırlamamalı.
    const guncel = {
      ...(varOlan ?? {}),
      id: satir.id,
      tenantId: satir.tenant_id,
      companyCode: metin(satir.company_code) || varOlan?.companyCode || '',
      companyName: metin(satir.company_name) || varOlan?.companyName || '',
      primarySectorId: sektor || varOlan?.primarySectorId || '',
      defaultBranchId: metin(satir.default_branch_id) || varOlan?.defaultBranchId || '',
      status: (metin(satir.status) || varOlan?.status || 'Aktif') as Company['status'],
      isApproved: true,
    } as Company

    // `normalizeCompany` (saveCompanies içinde) eksik alanları varsayılanlarla
    // doldurur; bu yüzden yeni kayıtta yalnızca yetkili alanları vermek yeterli.
    saveCompanies(
      varOlan
        ? mevcutlar.map(item => (item.id === satir.id ? guncel : item))
        : [guncel, ...mevcutlar],
    )

    await subeleriAynala(satir.id)

    return sektor
  } catch {
    // Bkz. yukarıdaki not: köprü girişin önüne geçmez.
    return ''
  }
}
