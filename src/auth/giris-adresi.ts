// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Kullanıcı adını giriş adresine çevirmek
//
// ── SORUN ─────────────────────────────────────────────────────────────────
// Supabase Auth yalnız E-POSTA ile giriş yapar. Ama personelin e-postası
// YOK — karar bu (bkz. docs/yetki-ekrani.md): işletme sahibi gerçek
// e-postasıyla girer, personel kullanıcı adı + şifre ile girer.
// 0076 personel hesabını açtı, giriş yolunu açmadı: hesap vardı, kişi
// giremiyordu. 11.10'da Emrah "depocu" hesabını açıp haklı olarak sordu:
// "şimdi bu kullanıcı adı parola ile nasıl giriş yapıcam?"
//
// ── ÇÖZÜM ────────────────────────────────────────────────────────────────
// Kişi giriş adını yazar. Giriş yapmadan ÖNCE sunucuya tek bir soru
// sorulur: "bu adın giriş adresi nedir?" (`giris_adresi_bul`, 0077/0078).
// Dönen adresle normal Supabase girişi yapılır. Kullanıcı o adresi hiç
// görmez.
//
// ── ⚠️ GİRİŞ ADI FİRMAYI İÇERİR (0078) ───────────────────────────────────
//     alaattin.kocatepe@ABCGIDA
// Emrah sordu: "35 firma × 40 personel varsa 'depocu' yazarak giriş yapmak
// ne kadar doğru?" Hiç doğru değil — onuncu firmanın depocusu da aynı şeyi
// yazıyor. Firma kodu giriş adının PARÇASI olunca çakışma biter ve
// kullanıcıya ikinci bir kutu açmak gerekmez.
// ⚠️ A5'te her müşteriye alt alan adı verilince `@ABCGIDA` adresten gelecek.
//
// ⚠️ ADRES BURADA UYDURULMAZ. Kuraldan (kullanıcıadı@işletmekodu.miyop.local)
// üretmek kolay olurdu ve İŞLETME SAHİBİNİ KAPIDA BIRAKIRDI — onun giriş
// adresi gerçek e-postası ve kurala uymuyor. Gerçek adres tek bir yerde
// duruyor: Supabase Auth. Sunucu oradan okuyor.
//
// ⚠️ BU DOSYA ŞİFRE GÖRMEZ. Yalnız bir ad çevirisi yapar.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

/**
 * Girdi KESİNLİKLE bir e-posta mı? (sunucuya sormadan)
 *
 * ⚠️ "@ VAR MI" ARTIK YETMİYOR (0078). Giriş adı da @ taşıyor:
 * `alaattin.kocatepe@ABCGIDA`. İlk sürüm @ görünce "e-postadır" deyip
 * olduğu gibi Supabase'e gönderiyordu — yeni giriş adlarının hiçbiri
 * çalışmazdı.
 *
 * Ayıran şey @'in SAĞI: işletme kodlarında nokta YOKTUR (harf ve rakama
 * indirgenirler), e-posta alan adlarında ise hep vardır.
 *   alaattin.kocatepe@ABCGIDA          → nokta yok  → sunucuya sor
 *   emrah@gmail.com                    → nokta var  → e-posta
 *   depocu@abcgida.miyop.local         → nokta var  → zaten gerçek adres
 *
 * ⚠️ Bu bir HIZ kısayolu, bir kural değil. Yanılırsa bile zarar yok:
 * sunucu tanımadığı alan adını zaten e-posta sayıp olduğu gibi döndürüyor.
 */
export const kesinEpostaMi = (girdi: string): boolean => {
  const g = (girdi || '').trim()
  if(!g.includes('@')) return false
  return g.slice(g.indexOf('@') + 1).includes('.')
}

/**
 * Kullanıcı adını (ya da e-postayı) Supabase giriş adresine çevirir.
 *
 * @param girdi    Kişinin giriş ekranına yazdığı şey: "depocu" ya da bir e-posta.
 * @param isletme  İşletme kodu — yalnız aynı kullanıcı adı birden çok
 *                 işletmede varsa gerekir. Normalde boş geçilir.
 *
 * ⚠️ BULUNAMADI DİYE HATA ATMIYOR. Sunucu bulunamayan ad için de geçerli
 * biçimde sahte bir adres döndürüyor (`<ad>@bulunamadi.miyop.local`); o
 * adresle giriş "kullanıcı adı veya şifre hatalı" ile biter — yani var olan
 * ama şifresi yanlış girilen hesapla AYNI cevap. Burada ayırt edici bir
 * hata atsaydık, ekran "bu kullanıcı adı var mı" sorusunu isteyen herkese
 * cevaplayan bir araca dönerdi.
 */
export const girisAdresiniCoz = async (
  girdi: string,
  isletme?: string,
): Promise<string> => {
  const temiz = (girdi || '').trim()
  if(kesinEpostaMi(temiz)) return temiz.toLowerCase()
  if(!temiz) return temiz
  if(!isSupabaseConfigured()) return temiz

  const { data, error } = await getSupabase().rpc('giris_adresi_bul', {
    p_kullanici: temiz,
    p_isletme: (isletme || '').trim() || null,
  })

  if(error || typeof data !== 'string' || data.length === 0){
    // ⚠️ Çeviri yapılamadıysa girdiyi OLDUĞU GİBİ geçiyoruz. Sebep: ağ
    // arızasında kullanıcı adıyla giriş çalışmayacak, ama E-POSTASIYLA
    // giren işletme sahibi etkilenmemeli. Burada hata atsaydık, bir RPC
    // arızası bütün girişleri kilitlerdi.
    if(error) console.warn('[MİYOP] Giriş adresi çözülemedi:', error.message)
    return temiz
  }

  return data
}
