// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · KULLANICILAR VE YETKİLER
//
// Emrah (03.10.2026): *"Kaç yetki gerekiyorsa personel oluştururken onun
// yetkilerini de belirleyebileceğimiz ekran olmalı. Örneğin depodaki adam
// mal çıkarabilsin veya müdür, aşçı mal çıkaramasın."*
//
// Emrah (04.10.2026, ekranı gördükten sonra): *"Roller ve Ne yapabilir
// kısımları birbirine karışmış durumda. Kişi listesi ekranda baya geniş yer
// kaplıyorken roller çok dar bir alana sıkışmış, üstelik rolleri verebilmek
// için aşağı scrolllamak gerekiyor. … rollere mi kişileri tanımlayalım yoksa
// kişilere mi rol atayalım? 35-40 kişinin çalıştığı fabrikayı düşün."*
//
// ── İKİ KARAR ──────────────────────────────────────────────────────────────
//
// 1 · ANA EKRAN ROL ÖNCE. 40 kişilik bir fabrikada kurulumu kişi kişi
//     dolaşmak 40 ekran demek; rolü açıp altı kişiyi tiklemek bir ekran.
//     Denetim sorusu da ("kimde mal çıkarma var") rol tarafından cevaplanır.
//
// 2 · LİSTE ve KART AYNI ANDA DURMUYOR. Önceki hâlde kişi tablosu geniş,
//     yetki paneli 360 piksellik bir şeride sıkışmıştı; rol tiklemek için
//     sayfanın dibine inmek gerekiyordu. Artık seçim listeyi DEĞİŞTİRİYOR:
//     kart tam genişlikte açılıyor, içinde iki sütun — solda üyelik/roller,
//     sağda ne yapabildiği. Geri düğmesi listeye döndürüyor.
//
// ⚠️ KİŞİ TARAFI KAPANMADI ve kapanamaz. Etkin yetki bütün rollerin
// BİRLEŞİMİDİR (0036): yalnız rol tarafından bakan biri, birini Depo'ya
// eklerken onun ayrıca Muhasebe'de de olduğunu göremez. "Bu kişi TOPLAMDA ne
// yapabiliyor" sorusunun tek cevabı kişi kartıdır; rol kartındaki her isim
// oraya açılıyor.
//
// ⚠️ İKİ TÜR ÜYELİK AYRI DAVRANIR:
//   BİRİNCİL (`app_user.role_code`) → `set_primary_role` (0060)
//   EK       (`user_role`)          → `assign_user_roles` (0015)
// Aynı listede aynı biçimde gösterseydik, "Çıkar" düğmesinin neden bazı
// satırlarda olmadığı anlaşılmazdı.
//
// ⚠️ KULLANICI OLUŞTURMA BU EKRANDA YOK ve bu bilerek. Gerçek kullanıcı
// açmak bir Supabase Auth hesabı + `app_user` kaydı demek; yarısı çalışan bir
// düğme koymaktansa ekranın bunu AÇIKÇA söylemesi doğru.
//
// ⚠️ ROL İÇERİĞİ DEĞİŞTİRİLEMEZ. `role_permission` tablosuna uygulamanın
// yalnızca SELECT yetkisi var (0006/0007). Kişiye rol eklenir ya da çıkarılır.
//
// ⚠️ BU EKRAN BİR GÜVENLİK SINIRI DEĞİLDİR. Gerçek koruma veritabanındadır
// (RLS · kolon GRANT'leri · `assign_user_roles` · `set_primary_role`).
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { User } from '../types'
import {
  applyRoleMembership,
  assignableRolesFor,
  canAssignRoles,
  loadRoleAssignmentData,
  saveUserRoles,
  setPrimaryRole,
  SupabaseNotConfiguredError,
  type RoleAssignmentData,
} from '../authorization/role-assignment.repository'
import {
  alanAgaci,
  anaGorevDegisinceKalanRol,
  etkinIzinler,
  kritikYetkiler,
  onayCumlesi,
  onayYetkileri,
  rolAgaci,
  rolCikarilmis,
  rolCumlesi,
  rolEklenmis,
  roleEklenebilirler,
  rolKatkisi,
  rolUyeleri,
  type AlanDugumu,
  type RolDugumu,
} from '../authorization/yetki-ozeti'

type Props = { currentUser: User }
type Sekme = 'roller' | 'kisiler'

/**
 * Tümdengelimin alt iki kademesi: ALAN → tek tek yetkiler.
 *
 * ⚠️ Açılır kapanır, çünkü bir rolün sekiz alanı olabiliyor ve hepsi birden
 * açıkken ekran yine okunmaz bir listeye dönüyor. İlk açılışta İŞ YAPILAN ilk
 * alan açık geliyor: aranan satır "bu kişi neyi DEĞİŞTİREBİLİR".
 *
 * `key` olarak rol/kişi kodu verilerek sıfırlanır.
 */
function YetkiAgaci({
  alanlar,
  kaynakGoster = false,
}: {
  alanlar: AlanDugumu[]
  kaynakGoster?: boolean
}){
  const [acik, setAcik] = React.useState<string[]>(() => {
    const isAlani = alanlar.find(a => a.yaparSayisi > 0) ?? alanlar[0]
    return isAlani ? [isAlani.alan] : []
  })

  const cevir = (alan: string) =>
    setAcik(o => o.includes(alan) ? o.filter(a => a !== alan) : [...o, alan])

  if(alanlar.length === 0){
    return (
      <p className="muted">
        Hiçbir yetkisi yok. Programa girebilir ama hiçbir ekranı açamaz.
      </p>
    )
  }

  return (
    <div className="yetki-agac">
      {alanlar.map(a => {
        const acikMi = acik.includes(a.alan)
        const gorme = a.yetenekler.length - a.yaparSayisi
        return (
          <div className={`yetki-dal${acikMi ? ' acik' : ''}`} key={a.alan}>
            <button
              type="button" className="yetki-dal-basi"
              aria-expanded={acikMi} onClick={() => cevir(a.alan)}
            >
              <span className="yetki-dal-isaret" aria-hidden="true">{acikMi ? '−' : '+'}</span>
              <strong>{a.alan}</strong>
              <span className="muted">
                {a.yaparSayisi > 0 && `${a.yaparSayisi} iş yapar`}
                {a.yaparSayisi > 0 && gorme > 0 && ' · '}
                {gorme > 0 && `${gorme} şeyi görür`}
              </span>
              {a.kritikSayisi > 0 && (
                <span className="onem-rozeti kritik">{a.kritikSayisi} kritik</span>
              )}
            </button>

            {acikMi && (
              <ul className="yetenek-listesi">
                {a.yetenekler.map(y => (
                  <li key={y.izinKodu} className={y.kritik ? 'kritik' : undefined}>
                    <span className={`yetenek-turu ${y.tur}`}>
                      {y.tur === 'yapar' ? 'YAPAR' : 'görür'}
                    </span>
                    <span className="yetenek-cumle">{y.cumle}</span>
                    {kaynakGoster && y.kaynakRoller.length > 0 && (
                      <small className="muted">Kaynak: {y.kaynakRoller.join(', ')}</small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function KullanicilarVeYetkiler({ currentUser }: Props){
  const [data, setData] = React.useState<RoleAssignmentData | null>(null)
  const [durum, setDurum] = React.useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor')
  const [hata, setHata] = React.useState('')
  const [bilgi, setBilgi] = React.useState('')
  const [sekme, setSekme] = React.useState<Sekme>('roller')
  const [seciliRol, setSeciliRol] = React.useState<string | null>(null)
  const [seciliKisi, setSeciliKisi] = React.useState<string | null>(null)
  const [tikli, setTikli] = React.useState<string[]>([])
  const [eklenecek, setEklenecek] = React.useState<string[]>([])
  const [yeniAnaGorev, setYeniAnaGorev] = React.useState('')
  const [calisiyor, setCalisiyor] = React.useState(false)

  const yetkili = canAssignRoles(currentUser.permissions)

  const yukle = React.useCallback(async () => {
    setDurum('yukleniyor'); setHata('')
    try {
      setData(await loadRoleAssignmentData())
      setDurum('hazir')
    } catch (e) {
      setHata(e instanceof SupabaseNotConfiguredError
        ? e.message
        : `Yetki verileri yüklenemedi: ${(e as Error).message}`)
      setDurum('hata')
    }
  }, [])

  React.useEffect(() => { if(yetkili) void yukle() }, [yetkili, yukle])

  // Yetki kontrolü ARAYÜZ içindir; gerçek karar sunucudadır. Bu blok atlansa
  // bile RPC reddeder.
  if(!yetkili){
    return (
      <div className="users-page">
        <div className="page-title"><div><h2>Kullanıcılar ve Yetkiler</h2></div></div>
        <section className="card empty-state">
          <p><strong>Bu ekranı görmek için kullanıcı veya rol yönetimi yetkisi gerekiyor.</strong></p>
          <p className="muted">
            Kimin neye erişeceğine karar vermek, işi yürütmekten ayrı bir
            yetkidir: müdür işi yürütür, yetki dağıtımı işletme sahibindedir.
          </p>
        </section>
      </div>
    )
  }

  const rolIzinleri = data?.rolIzinleri ?? {}
  const kullanicilar = data?.users ?? []
  const atamalar = data?.assignments ?? {}
  const roller = assignableRolesFor(
    data?.roles ?? [],
    currentUser.role === 'Admin' ? 'admin' : 'personel',
  )
  const rolAdlari: Record<string, string> = Object.fromEntries(
    (data?.roles ?? []).map(r => [r.code, r.name || r.code]),
  )
  const rolAdi = (kod: string) => rolAdlari[kod] || kod || '—'

  const kisiAc = (id: string) => {
    setSekme('kisiler')
    setSeciliKisi(id)
    setTikli([...(atamalar[id] ?? [])])
    setYeniAnaGorev(kullanicilar.find(u => u.id === id)?.primaryRoleCode ?? '')
    setHata(''); setBilgi('')
  }

  const rolAc = (kod: string) => {
    setSekme('roller')
    setSeciliRol(kod)
    setEklenecek([])
    setHata(''); setBilgi('')
  }

  const tikleDegistir = (kod: string) =>
    setTikli(o => o.includes(kod) ? o.filter(k => k !== kod) : [...o, kod])

  // ── Kişi kartı: EK rolleri kaydet ────────────────────────────────────────
  const ekRolleriKaydet = async () => {
    if(!seciliKisi) return
    setCalisiyor(true); setHata(''); setBilgi('')
    try {
      await saveUserRoles(seciliKisi, tikli)
      await yukle()
      // ⚠️ Yeni yetkiler BİR SONRAKİ GİRİŞTE işler: izinler oturum açılırken
      // okunuyor. Söylemeseydik yönetici "kaydettim ama olmadı" derdi.
      setBilgi('Roller kaydedildi. Kullanıcı yeni yetkileriyle BİR SONRAKİ GİRİŞİNDE çalışmaya başlar.')
    } catch (e) { setHata((e as Error).message) }
    finally { setCalisiyor(false) }
  }

  // ── Kişi kartı: ANA GÖREVİ değiştir ──────────────────────────────────────
  const anaGoreviDegistir = async () => {
    if(!seciliKisi || !yeniAnaGorev) return
    const kisi = kullanicilar.find(u => u.id === seciliKisi)
    const eski = kisi?.primaryRoleCode ?? ''
    setCalisiyor(true); setHata(''); setBilgi('')
    try {
      await setPrimaryRole(seciliKisi, yeniAnaGorev)
      await yukle()
      // ⚠️ 0060 EK ROLLERE DOKUNMUYOR. Eski rol ek rol olarak duruyorsa
      // yetkiler DEVAM EDER. Söylemeseydik "sevkiyata aldım ama hâlâ depodan
      // mal çıkarıyor" şikâyeti doğardı.
      const kalan = anaGorevDegisinceKalanRol(eski, atamalar[seciliKisi] ?? [])
      setBilgi(kalan
        ? `Ana görev değişti. DİKKAT: "${rolAdi(kalan)}" rolü EK rol olarak duruyor,`
          + ' o rolün yetkileri devam ediyor. Kaldırmak için aşağıdaki tiki çıkarın.'
        : 'Ana görev değişti. Yeni yetkiler kullanıcının BİR SONRAKİ GİRİŞİNDE işler.')
    } catch (e) { setHata((e as Error).message) }
    finally { setCalisiyor(false) }
  }

  // ── Rol kartı: üye ekle / çıkar ──────────────────────────────────────────
  const uyeEkle = async () => {
    if(!seciliRol || eklenecek.length === 0) return
    setCalisiyor(true); setHata(''); setBilgi('')
    try {
      const sonuc = await applyRoleMembership(eklenecek.map(id => ({
        userId: id,
        ad: kullanicilar.find(u => u.id === id)?.fullName || id,
        roleCodes: rolEklenmis(atamalar[id] ?? [], seciliRol),
      })))
      await yukle()
      setEklenecek([])
      // ⚠️ Yarısı yazılmış değişiklik GİZLENMİYOR: her çağrı ayrı, biri
      // düşerse öncekiler yazılmış kalır.
      if(sonuc.hatalar.length > 0){
        setHata(`${sonuc.basarili} kişi eklendi, ${sonuc.hatalar.length} kişi eklenemedi: `
          + sonuc.hatalar.map(h => `${h.ad} (${h.mesaj})`).join(' · '))
      } else {
        setBilgi(`${sonuc.basarili} kişi bu role eklendi. Yetkiler bir sonraki girişlerinde işler.`)
      }
    } catch (e) { setHata((e as Error).message) }
    finally { setCalisiyor(false) }
  }

  const uyeCikar = async (userId: string, ad: string) => {
    if(!seciliRol) return
    setCalisiyor(true); setHata(''); setBilgi('')
    try {
      await saveUserRoles(userId, rolCikarilmis(atamalar[userId] ?? [], seciliRol))
      await yukle()
      setBilgi(`${ad} bu rolden çıkarıldı.`)
    } catch (e) { setHata((e as Error).message) }
    finally { setCalisiyor(false) }
  }

  // ── Hesaplamalar ─────────────────────────────────────────────────────────
  const rolDugumleri: RolDugumu[] = rolAgaci(roller, rolIzinleri)
  const acikRol = rolDugumleri.find(r => r.kod === seciliRol) ?? null
  const acikKisi = kullanicilar.find(u => u.id === seciliKisi) ?? null

  const degisti = seciliKisi
    ? JSON.stringify([...tikli].sort()) !== JSON.stringify([...(atamalar[seciliKisi] ?? [])].sort())
    : false

  // ⚠️ Önizleme TİKLENEN rollere göre hesaplanıyor, kayıtlı olana göre değil:
  // yönetici kaydetmeden ÖNCE ne vereceğini görsün.
  const onizlemeRoller = acikKisi ? [acikKisi.primaryRoleCode, ...tikli].filter(Boolean) : []
  const onizlemeIzinleri = acikKisi
    ? etkinIzinler(acikKisi.primaryRoleCode, tikli, rolIzinleri) : []
  const onizlemeAlanlar = alanAgaci(onizlemeIzinleri, {
    roller: onizlemeRoller, rolIzinleri, rolAdlari,
  })
  const onizlemeKritik = kritikYetkiler(onizlemeIzinleri)
  const onizlemeOnay = onayYetkileri(onizlemeIzinleri, data?.onayAdimlari ?? [])

  // Kendi ana görevini kimse değiştiremez — sunucu da reddeder (0060).
  const kendisi = Boolean(acikKisi && acikKisi.id === currentUser.id)

  return (
    <div className="users-page">
      <div className="page-title">
        <div>
          <h2>Kullanıcılar ve Yetkiler</h2>
          <p className="muted">
            Yetki ROLLE verilir. Bir kişi birden çok rol taşıyabilir; etkin
            yetkisi hepsinin <strong>toplamıdır</strong>.
          </p>
        </div>
      </div>

      <div className="form-actions">
        <button
          className={`btn ${sekme === 'roller' ? 'primary' : ''}`}
          type="button"
          onClick={() => { setSekme('roller'); setSeciliRol(null); setHata(''); setBilgi('') }}
        >
          Roller ({rolDugumleri.length})
        </button>
        <button
          className={`btn ${sekme === 'kisiler' ? 'primary' : ''}`}
          type="button"
          onClick={() => { setSekme('kisiler'); setSeciliKisi(null); setHata(''); setBilgi('') }}
        >
          Kişiler ({kullanicilar.length})
        </button>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-success">{bilgi}</div>}
      {durum === 'yukleniyor' && <section className="card empty-state">Yükleniyor…</section>}

      {/* ══ ROLLER · LİSTE ════════════════════════════════════════════════ */}
      {durum === 'hazir' && sekme === 'roller' && !acikRol && (
        <section className="card">
          <div className="section-header compact">
            <h3>Roller</h3>
            <p className="muted">
              Bir rolü açın: içinde kimlerin olduğunu görür, kişi ekler ve o
              rolün hangi alanlarda ne yapabildiğini tek tek açarsınız.
            </p>
          </div>

          <div className="rol-kart-grid">
            {rolDugumleri.map(r => {
              const uyeler = rolUyeleri(r.kod, kullanicilar, atamalar)
              return (
                <button type="button" className="rol-kart" key={r.kod} onClick={() => rolAc(r.kod)}>
                  <span className="rol-kart-bas">
                    <strong>{r.ad}</strong>
                    {r.kritikSayisi > 0 && (
                      <span className="onem-rozeti kritik">{r.kritikSayisi} kritik</span>
                    )}
                  </span>
                  {r.aciklama && <span className="muted rol-kart-aciklama">{r.aciklama}</span>}
                  <span className="rol-kart-sayac">
                    {/* Üye sayısı EN ÖNDE: "bu rolde kimse yok mu" sorusu,
                        rol kataloğuna bakan yöneticinin ilk sorusu. */}
                    <strong>{uyeler.length === 0 ? 'Kimse yok' : `${uyeler.length} kişi`}</strong>
                    <span className="muted">
                      {' · '}{r.alanlar.length} alan · {r.izinSayisi} yetki
                      {r.saltOkur && ' · yalnız okur'}
                    </span>
                  </span>
                </button>
              )
            })}
            {rolDugumleri.length === 0 && (
              <p className="muted">Veritabanında rol bulunamadı.</p>
            )}
          </div>
        </section>
      )}

      {/* ══ ROLLER · KART ═════════════════════════════════════════════════ */}
      {durum === 'hazir' && sekme === 'roller' && acikRol && (() => {
        const uyeler = rolUyeleri(acikRol.kod, kullanicilar, atamalar)
        const adaylar = roleEklenebilirler(acikRol.kod, kullanicilar, atamalar)
        return (
          <section className="card">
            <div className="kart-ustu">
              <button type="button" className="btn" onClick={() => setSeciliRol(null)}>
                ‹ Rollere dön
              </button>
            </div>

            <div className="section-header compact">
              <h3>{acikRol.ad}</h3>
              {acikRol.aciklama && <p className="muted">{acikRol.aciklama}</p>}
              <p className="muted">{rolCumlesi(acikRol)}</p>
            </div>

            {acikRol.saltOkur && (
              <div className="form-info">
                <strong>Bu rol hiçbir şeyi değiştiremez.</strong> Her şeyi görür,
                hiçbir kayda dokunamaz — denetçi, danışman ve mali müşavir için
                uygun olan budur.
              </div>
            )}

            {acikRol.kritikSayisi > 0 && (
              <div className="form-error">
                <strong>Bu rol {acikRol.kritikSayisi} kritik yetki taşıyor.</strong>{' '}
                Kritik dediğimiz şeyler yanlış kişide olursa en pahalıya
                patlayanlar: mal çıkarmak, sipariş onaylamak, irsaliye kesmek,
                yetki dağıtmak. Sağdaki ağaçta kırmızı işaretli satırlar.
              </div>
            )}

            <div className="yetki-detay">
              {/* ── SOL: ÜYELER ─────────────────────────────────────────── */}
              <div>
                <h4>Bu roldeki kişiler ({uyeler.length})</h4>
                {uyeler.length === 0 && (
                  <p className="muted">
                    Bu rol şu anda kimsede yok. Aşağıdan kişi ekleyebilirsiniz.
                  </p>
                )}
                {uyeler.length > 0 && (
                  <ul className="uye-listesi">
                    {uyeler.map(u => (
                      <li key={u.id}>
                        <button type="button" className="baglanti-dugmesi"
                          onClick={() => kisiAc(u.id)}>{u.ad}</button>
                        {!u.aktif && <span className="is-critical"> · pasif</span>}
                        {u.birincil ? (
                          /* ⚠️ Ana görev `user_role`da değil `app_user`da durur;
                             buradan çıkarılamaz. "Çıkar" düğmesi koyup
                             çalışmaması, çalışmamasından daha kötü olurdu. */
                          <span className="muted"> — ana görevi</span>
                        ) : (
                          <>
                            <span className="muted"> — ek rol</span>
                            <button
                              type="button" className="baglanti-dugmesi tehlike"
                              disabled={calisiyor}
                              onClick={() => void uyeCikar(u.id, u.ad)}
                            >
                              çıkar
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <h4>Kişi ekle</h4>
                {adaylar.length === 0 && (
                  <p className="muted">İşletmedeki herkes zaten bu rolde.</p>
                )}
                {adaylar.length > 0 && (
                  <>
                    <div className="uye-secim">
                      {adaylar.map(k => (
                        <label className="check-row" key={k.id}>
                          <input
                            type="checkbox"
                            checked={eklenecek.includes(k.id)}
                            onChange={() => setEklenecek(o =>
                              o.includes(k.id) ? o.filter(x => x !== k.id) : [...o, k.id])}
                          />
                          <span>
                            <strong>{k.fullName || k.username}</strong>
                            <small className="muted"> — ana görevi: {rolAdi(k.primaryRoleCode)}</small>
                            {!k.isActive && <small className="is-critical"> · pasif hesap</small>}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="form-actions">
                      <button
                        className="btn primary" type="button"
                        disabled={calisiyor || eklenecek.length === 0}
                        onClick={() => void uyeEkle()}
                      >
                        {calisiyor ? 'Ekleniyor…' : `Seçilen ${eklenecek.length} kişiyi ekle`}
                      </button>
                    </div>
                    <p className="muted">
                      Eklemek kişinin başka rollerini KALDIRMAZ; bu rol
                      üzerine eklenir.
                    </p>
                  </>
                )}
              </div>

              {/* ── SAĞ: NE YAPABİLİR ───────────────────────────────────── */}
              <div>
                <h4>Bu rol ne yapabilir</h4>
                {/* key: rol değişince açık alanlar sıfırlanır. */}
                <YetkiAgaci key={acikRol.kod} alanlar={acikRol.alanlar} />

                {/*
                  ⚠️ Eksik olanı SÖYLÜYORUZ. Rolün içindeki tek bir izni açıp
                  kapatacak bir yer YOK; aradığı ayarı bulamayan kullanıcı
                  yanlış yerde arar.
                */}
                <div className="form-info">
                  <strong>Rolün içeriği buradan değiştirilemez.</strong> Roller
                  sistem genelinde sabittir: "bu role bir de şunu ver" diye tek
                  bir yetki eklenemez. Kişiye rol EKLENİR ya da ÇIKARILIR.
                  İşletmeye özel rol tanımlama yol haritasında duruyor.
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {/* ══ KİŞİLER · LİSTE ═══════════════════════════════════════════════ */}
      {durum === 'hazir' && sekme === 'kisiler' && !acikKisi && (
        <section className="card">
          <div className="section-header compact">
            <h3>Kişiler</h3>
            <p className="muted">
              Bir kişiyi açın: TOPLAM yetkisini, hangi yetkinin hangi rolden
              geldiğini ve rollerini görürsünüz.
            </p>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th><th>Ana görevi</th><th>Ek roller</th>
                  <th>Kritik yetki</th><th>Aktif</th><th></th>
                </tr>
              </thead>
              <tbody>
                {kullanicilar.map(u => {
                  const ek = atamalar[u.id] ?? []
                  const izin = etkinIzinler(u.primaryRoleCode, ek, rolIzinleri)
                  const kritik = kritikYetkiler(izin)
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.fullName || u.username}</strong>
                        <br /><span className="muted">{u.username}</span>
                      </td>
                      <td>{rolAdi(u.primaryRoleCode)}</td>
                      <td className="muted">
                        {ek.length ? ek.map(k => rolAdi(k)).join(', ') : '—'}
                      </td>
                      <td>
                        {/* Kritik sayısı listede de görünüyor: "kimde mal
                            çıkarma var" sorusu her kişiyi açmadan cevaplanmalı. */}
                        {kritik.length === 0
                          ? <span className="muted">—</span>
                          : <span className="onem-rozeti kritik">{kritik.length}</span>}
                      </td>
                      <td>{u.isActive ? 'Evet' : <span className="is-critical">Pasif</span>}</td>
                      <td className="row-actions">
                        <button className="btn" type="button" onClick={() => kisiAc(u.id)}>
                          Yetkilerini aç ›
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {kullanicilar.length === 0 && (
                  <tr><td colSpan={6} className="muted">Veritabanında kullanıcı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/*
            ⚠️ Eksik olanı SÖYLÜYORUZ. Yarısı çalışan bir "Yeni Kullanıcı"
            düğmesi, olmayan bir yolu varmış gibi gösterir.
          */}
          <div className="form-info">
            <strong>Yeni kullanıcı bu ekrandan açılmıyor.</strong> Gerçek bir
            kullanıcı açmak, giriş hesabı (Supabase Auth) + işletme kaydı
            demek. Bugün bu iş Supabase panelinden yapılıyor; hesap açıldıktan
            sonra kişi bu listede görünür ve rolleri buradan verilir. Davetle
            açma akışı yol haritasında duruyor.
          </div>
        </section>
      )}

      {/* ══ KİŞİLER · KART ════════════════════════════════════════════════ */}
      {durum === 'hazir' && sekme === 'kisiler' && acikKisi && (
        <section className="card">
          <div className="kart-ustu">
            <button type="button" className="btn" onClick={() => setSeciliKisi(null)}>
              ‹ Kişilere dön
            </button>
          </div>

          <div className="section-header compact">
            <h3>{acikKisi.fullName || acikKisi.username}</h3>
            <p className="muted">
              Giriş adı: {acikKisi.username}
              {!acikKisi.isActive && <> · <span className="is-critical">hesap pasif</span></>}
              {degisti && <> · <span className="is-critical">kaydedilmemiş rol değişikliği var</span></>}
            </p>
          </div>

          {onizlemeKritik.length > 0 && (
            <div className="form-error">
              <strong>Kritik yetkiler:</strong>
              <ul>{onizlemeKritik.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          )}

          <div className="yetki-detay">
            {/* ── SOL: ROLLER ───────────────────────────────────────────── */}
            <div>
              <h4>Ana görevi</h4>
              <p className="muted">
                Ana görev bir kişinin tek asıl rolüdür. Değiştirmek, kişiyi o
                departmandan alıp diğerine vermektir.
              </p>
              <div className="ana-gorev-satiri">
                <select
                  value={yeniAnaGorev}
                  disabled={calisiyor || kendisi}
                  onChange={e => setYeniAnaGorev(e.target.value)}
                >
                  {roller.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                  {!roller.some(r => r.code === acikKisi.primaryRoleCode) && (
                    <option value={acikKisi.primaryRoleCode}>
                      {rolAdi(acikKisi.primaryRoleCode)}
                    </option>
                  )}
                </select>
                <button
                  className="btn" type="button"
                  disabled={calisiyor || kendisi || yeniAnaGorev === acikKisi.primaryRoleCode}
                  onClick={() => void anaGoreviDegistir()}
                >
                  Ana görevi değiştir
                </button>
              </div>
              {kendisi && (
                /* ⚠️ Sunucu da reddediyor (0060). Burada söylemek, reddedilecek
                   bir düğmeye bastırmamak için. */
                <p className="muted">
                  <strong>Kendi ana görevinizi değiştiremezsiniz.</strong> Kendinizi
                  yetkisiz bırakırsanız işletmeye kimse giremez.
                </p>
              )}
              <p className="muted">
                Ana görevi değiştirmek EK rolleri kaldırmaz. Eski rol aşağıda
                tikliyse yetkileri devam eder.
              </p>

              <h4>Ek roller</h4>
              <p className="muted">
                Tikler ana görevin ÜZERİNE eklenir. Sağdaki ağaç tiklediğiniz
                hâle göre anında güncellenir — kaydetmeden önce ne
                vereceğinizi görürsünüz.
              </p>
              <div className="role-checkbox-grid">
                {roller.map(r => {
                  // ⚠️ Rolün TAMAMI değil, EKLEYECEĞİ gösteriliyor: izinlerin
                  // yarısı kişide zaten olabilir.
                  const katki = tikli.includes(r.code)
                    ? null
                    : rolKatkisi(onizlemeIzinleri, rolIzinleri[r.code] ?? [])
                  return (
                    <label className="check-row" key={r.code} title={r.description}>
                      <input
                        type="checkbox"
                        checked={tikli.includes(r.code)}
                        onChange={() => tikleDegistir(r.code)}
                      />
                      <span>
                        <strong>{r.name}</strong>
                        {r.code === acikKisi.primaryRoleCode && (
                          <small className="muted"> · ana görevi</small>
                        )}
                        {r.description && <small className="muted"> — {r.description}</small>}
                        {katki && katki.yeni.length > 0 && (
                          <small className={katki.yeniKritik > 0 ? 'is-critical' : 'muted'}>
                            {' '}· eklerse {katki.yeni.length} yeni yetki
                            {katki.yeniKritik > 0 && `, ${katki.yeniKritik} tanesi kritik`}
                          </small>
                        )}
                        {katki && katki.yeni.length === 0 && (
                          <small className="muted"> · yeni bir şey eklemez</small>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="form-actions">
                <button
                  className="btn primary" type="button"
                  disabled={calisiyor || !degisti}
                  onClick={() => void ekRolleriKaydet()}
                >
                  {calisiyor ? 'Kaydediliyor…' : 'Ek rolleri kaydet'}
                </button>
                <button
                  className="btn" type="button"
                  onClick={() => rolAc(acikKisi.primaryRoleCode)}
                >
                  Ana görevini incele ›
                </button>
              </div>
            </div>

            {/* ── SAĞ: NE YAPABİLİR ─────────────────────────────────────── */}
            <div>
              <h4>Toplamda ne yapabilir</h4>
              <p className="muted">
                Alan başlığına basın, o alanda tek tek neyi yapabildiği açılır.
                Her satırın altında yetkinin HANGİ ROLDEN geldiği yazıyor —
                geri almak için hangi tiki kaldıracağınız belli olsun.
              </p>
              {/* key: kişi ya da tikler değişince açık alanlar sıfırlanır. */}
              <YetkiAgaci
                key={`${acikKisi.id}:${[...tikli].sort().join(',')}`}
                alanlar={onizlemeAlanlar}
                kaynakGoster
              />

              <h4>Sipariş onay zinciri</h4>
              <p className="muted">{onayCumlesi(onizlemeOnay)}</p>
              {onizlemeOnay.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table compact">
                    <thead><tr><th>Adım</th><th>Tür</th><th>Karar verebilir mi</th></tr></thead>
                    <tbody>
                      {onizlemeOnay.map(a => (
                        <tr key={a.kod}>
                          <td>{a.ad}</td>
                          <td className="muted">{a.bloklar ? 'onay' : 'görüş'}</td>
                          <td>
                            {a.kararVerebilir
                              ? <strong>Evet</strong>
                              : <span className="muted">Hayır</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
