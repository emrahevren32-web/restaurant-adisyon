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
import {
  loadBranchPermissions, loadBranches, loadCompanies,
  saveBranchPermissions, saveBranches, saveCompanies,
} from '../storage'
import type { Branch, BranchPermission, Company, User } from '../types'

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
 * ⚠️ ESKİ DEMO KAYITLARININ KİMLİKLERİ (MIYOP-058 · ikinci yarı).
 *
 * Üreticileri sildik (`createDemoBranches`, `createDemoCompanies`) ama bu
 * yalnız YENİ üretimi durdurdu. Emrah'ın ve demo kurulumların
 * tarayıcısında bu satırlar **zaten yazılı** ve köprü onları koruyordu.
 *
 * ⚠️ İlk onarımım yetmedi, Codex haklıydı: köprü "bu firmaya ait olmayan
 * şubeleri koru" diyordu — demo şubelerin `companyId`si uydurma bir demo
 * firmaydı, yani "başka firma" sayılıp korunuyorlardı. Kalıntıyı temizlemek
 * için **kimliği bilinen kayıtları hedeflemek** gerekiyor.
 *
 * ⚠️ Liste KAPALI ve sabit: yalnız bizim ürettiğimiz, kimliği bilinen
 * kayıtlar siliniyor. Desene göre silmek ("`_demo` ile bitenler") tehlikeli
 * olurdu — gerçek bir firma kendi kaydına o adı verebilir.
 */
const ESKI_DEMO_SUBE_KIMLIKLERI = [
  'branch_merkez', 'branch_istanbul', 'branch_ankara', 'branch_izmir',
]
const ESKI_DEMO_FIRMA_KIMLIKLERI = [
  'company_abc_cafe_demo', 'company_ornek_isletme_demo', 'company_kahve_duragi_demo',
]

/**
 * Tarayıcıda kalmış demo kayıtlarını siler. Bir kez çalışması yeterli ama
 * tekrar çalışması da zararsız (idempotent) — bayrak tutmuyoruz, çünkü
 * bayrak tutan bir temizlik, bayrağı olan ama temizlenmemiş bir tarayıcıda
 * sessizce atlanır.
 */
export const eskiDemoKalintilariniTemizle = (): void => {
  try{
    const subeler = loadBranches()
    const kalanSubeler = subeler.filter(sube => (
      !ESKI_DEMO_SUBE_KIMLIKLERI.includes(sube.id)
      && !ESKI_DEMO_FIRMA_KIMLIKLERI.includes(sube.companyId ?? '')
    ))
    if(kalanSubeler.length !== subeler.length) saveBranches(kalanSubeler)

    const firmalar = loadCompanies({ allTenants: true, includeDeleted: true })
    const kalanFirmalar = firmalar.filter(
      firma => !ESKI_DEMO_FIRMA_KIMLIKLERI.includes(firma.id),
    )
    if(kalanFirmalar.length !== firmalar.length) saveCompanies(kalanFirmalar)
  }catch(hata){
    // ⚠️ Temizlik başarısız olursa giriş AKIŞI DURMAZ. Kalıntı bir sonraki
    // girişte yine denenir; kullanıcıyı kapıda bırakmak bundan kötüdür.
    console.warn('[MİYOP] Demo kalıntısı temizlenemedi:', hata)
  }
}

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

  // ⚠️ `satirlar.length === 0` ile ERKEN DÖNMÜYORUZ (Codex, 25.10).
  // Eskiden dönüyordu; yani veritabanı bu firma için boş cevap verdiğinde
  // yerel liste olduğu gibi kalıyordu ve temizlik ATLANIYORDU. Sorgu
  // BAŞARILI olduğuna göre (hata yukarıda yakalanıyor) boş cevap da bir
  // cevaptır: bu firmanın şubesi yok demektir.
  const mevcutlar = loadBranches()

  // ⚠️ 25.10.2026 · BU FONKSİYON SAHTE ŞUBELERİ KORUYORDU (MIYOP-058).
  //
  // Eski hâli `mevcutlar.map(...)` ile yerel listenin TAMAMINI koruyup
  // üstüne veritabanı satırlarını yazıyordu. Sonuç: veritabanında
  // karşılığı olmayan yerel şubeler — yani `createDemoBranches()`ın
  // ürettiği dört uydurma şube — her girişte yeniden KAYDEDİLİYORDU.
  // Üretici silindi (storage.ts) ama o kadarı yetmez: demo satırlar
  // Emrah'ın ve demo kurulumların tarayıcısında ZATEN YAZILI.
  //
  // ⚠️ YENİ KURAL: bu firmanın şubeleri için **yetkili kaynak
  // veritabanıdır.** Veritabanında olmayan yerel şube KORUNMAZ — eski
  // demo kalıntıları böylece ilk girişte kendiliğinden temizlenir, ayrı
  // bir temizlik betiği gerekmez.
  // ⚠️ BAŞKA firmaların yerel satırlarına DOKUNULMAZ: onları silmek,
  // MIYOP-063'ün ("bir firmayı kaydetmek diğerini düşürüyor") aynısını
  // burada tekrarlamak olurdu.
  const digerFirmalar = mevcutlar.filter(sube => sube.companyId !== firmaId)
  const buFirmaninYerelleri = new Map(
    mevcutlar.filter(sube => sube.companyId === firmaId).map(sube => [sube.id, sube])
  )

  const buFirmanin = satirlar.map(satir => (
    subeyeCevir(satir, buFirmaninYerelleri.get(satir.id))
  ))

  saveBranches([...digerFirmalar, ...buFirmanin])
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
 * Kişinin ŞUBE ERİŞİMİNİ aynalar (`user_branch_access` → localStorage).
 *
 * ── BULUNAN HATA (12.10.2026) ────────────────────────────────────────────
 * İlk personel hesabı açıldıktan sonra kişi giriş yaptı ve başlıkta
 * "Yetkili şube yok" yazdı. Veritabanında erişim satırı VARDI
 * (`user_branch_access`, 0076 onu yazıyor). Sorun şuydu: şube süzgeci
 * (`filterBranchesByPermission`) yönetici olmayan kullanıcı için
 * localStorage'daki `ra_branch_permissions` listesine bakıyor ve o liste
 * YALNIZCA ekrandan elle doldurulduğunda doluyordu. Yani hesabı sistem
 * açınca kişinin hiçbir şubesi görünmüyordu.
 *
 * ⚠️ BU BİR GÜVENLİK KAPISI DEĞİL, BİR GÖRÜNÜRLÜK AYNASIDIR. Gerçek sınır
 * veritabanında (RLS + `user_branch_access`). Burada yazdığımız kayıtlar
 * yalnız başlıktaki şube seçicinin ve eski ekranların ne göstereceğini
 * belirler. Bu yüzden veritabanında OLMAYAN bir erişim buraya yazılmaz:
 * liste her girişte sunucudakiyle değiştirilir, genişletilmez.
 */
const subeErisiminiAynala = async (user: User): Promise<void> => {
  const { data, error } = await getSupabase()
    .from('user_branch_access')
    .select('user_id, branch_id')
    .eq('user_id', user.id)

  if(error || !data) return

  const simdi = new Date().toISOString()
  const yeniler: BranchPermission[] = (data as { user_id: string; branch_id: string }[])
    .map(satir => ({
      id: `uba_${satir.user_id}_${satir.branch_id}`,
      tenantId: user.tenantId,
      userId: satir.user_id,
      branchId: satir.branch_id,
      canView: true,
      // ⚠️ Görme dışındaki haklar BURADAN gelmez. Kimin ne YAZABİLECEĞİNE
      // rol izinleri karar veriyor (0014/0015) ve asıl kapı RLS'tir;
      // burada true yazsaydık, ekranda açık görünen bir düğmenin sunucuda
      // reddedilmesine yol açardık.
      canCreate: false, canEdit: false, canDelete: false,
      createdAt: simdi, updatedAt: simdi,
    }))

  // Bu kullanıcıya ait ESKİ satırlar atılıyor: erişim geri alındıysa
  // localStorage'da kalıp hayalet yetki göstermesin.
  const digerleri = loadBranchPermissions().filter(izin => izin.userId !== user.id)
  saveBranchPermissions([...digerleri, ...yeniler])
}

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
  // ⚠️ Her girişte, Supabase yapılandırılmamış olsa bile. Kalıntı
  // tarayıcıda duruyor; sunucuya bağlı olup olmamakla ilgisi yok.
  eskiDemoKalintilariniTemizle()

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
    await subeErisiminiAynala(user)

    return sektor
  } catch {
    // Bkz. yukarıdaki not: köprü girişin önüne geçmez.
    return ''
  }
}
