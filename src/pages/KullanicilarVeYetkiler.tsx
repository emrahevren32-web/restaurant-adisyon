// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · KULLANICILAR VE YETKİLER
//
// Emrah (03.10.2026): *"Kaç yetki gerekiyorsa personel oluştururken onun
// yetkilerini de belirleyebileceğimiz ekran olmalı. Örneğin depodaki adam
// mal çıkarabilsin veya müdür, aşçı mal çıkaramasın, malı alıp kafasına göre
// başlayamasın. Siparişi onaylayanlar da böyle olmalı."*
//
// Emrah (aynı gün, ekranı gördükten sonra): *"Yetki verme ekranlarını
// tümdengelim şeklinde yapalım, depocu seçilince depoda yapabilecekleri
// açılsın, ordan başka bişey seçince yapabilecekleri açılsın vs vs öyle sona
// kadar gitsin. Aynısı muhasebeci, stokcu, nakliyeci vs kimler varsa hepsi
// için geçerli olsun."*
//
// ── EKRANIN İKİ YÜZÜ ───────────────────────────────────────────────────────
// Düz bir "ne yapabilir" listesi otuz iki satıra çıkıyordu ve okunmuyordu.
// Ekran artık iki sekme:
//
//   KİŞİLER → kim, hangi rolleri taşıyor, sonuçta ne yapabiliyor
//   ROLLER  → tümdengelim: rol seç → alanları açılır → alanı aç → tek tek
//             yetkiler. Depocu, muhasebeci, nakliyeci… hepsi aynı ağaçta.
//
// ── NEYİN YERİNE GELDİ ─────────────────────────────────────────────────────
// Eski `Users.tsx` üstte localStorage'a yazan bir kullanıcı tablosu
// taşıyordu. O tablo YALAN SÖYLÜYORDU — "kullanıcı oluşturdum" dediğinde
// hiçbir şey veritabanına gitmiyordu. Menüye konmadan önce kaldırıldı.
//
// ⚠️ KULLANICI OLUŞTURMA BU EKRANDA YOK ve bu bilerek. Gerçek kullanıcı
// açmak bir Supabase Auth hesabı + `app_user` kaydı demek; yarısı çalışan
// bir "Yeni Kullanıcı" düğmesi koymaktansa ekranın bunu AÇIKÇA söylemesi
// doğru.
//
// ⚠️ ROL İÇERİĞİ BU EKRANDAN DEĞİŞTİRİLEMEZ. `role_permission` tablosuna
// uygulamanın yalnızca SELECT yetkisi var (0006/0007): roller sistem
// genelinde sabit. Yani "depocuya bir de şu izni ver" diye tek izin
// eklenemez; kişiye ROL eklenir ya da çıkarılır. Ekran bunu yazıyor —
// yazmasaydı kullanıcı olmayan bir ayarı arardı.
//
// ⚠️ BU EKRAN BİR GÜVENLİK SINIRI DEĞİLDİR. Gerçek koruma veritabanındadır
// (RLS · kolon GRANT'leri · `assign_user_roles` RPC'si). Buradaki listeler
// "kim neyi yapabiliyor" sorusunu GÖSTERMEK içindir.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { User } from '../types'
import {
  assignableRolesFor,
  canAssignRoles,
  loadRoleAssignmentData,
  saveUserRoles,
  SupabaseNotConfiguredError,
  type RoleAssignmentData,
} from '../authorization/role-assignment.repository'
import {
  alanAgaci,
  etkinIzinler,
  kritikYetkiler,
  onayCumlesi,
  onayYetkileri,
  rolAgaci,
  rolCumlesi,
  rolKatkisi,
  type AlanDugumu,
  type RolDugumu,
} from '../authorization/yetki-ozeti'

type Props = { currentUser: User }
type Sekme = 'kisiler' | 'roller'

/**
 * Tümdengelimin alt iki kademesi: ALAN → tek tek yetkiler.
 *
 * ⚠️ Açılır kapanır, çünkü bir rolün altı alanı olabiliyor ve hepsi birden
 * açık olduğunda ekran yine okunmaz bir listeye dönüyor. İlk açılışta İŞ
 * YAPILAN ilk alan açık geliyor: yöneticinin aradığı satır "bu kişi neyi
 * DEĞİŞTİREBİLİR", "neyi görebilir" değil.
 *
 * `key` olarak rol/kişi kodu verilerek sıfırlanır — seçim değişince eski
 * açık alanlar kalmasın.
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
  const [sekme, setSekme] = React.useState<Sekme>('kisiler')
  const [secili, setSecili] = React.useState<string | null>(null)
  const [seciliRol, setSeciliRol] = React.useState<string | null>(null)
  const [tikli, setTikli] = React.useState<string[]>([])
  const [kaydediliyor, setKaydediliyor] = React.useState(false)
  const [bilgi, setBilgi] = React.useState('')

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

  // Yetki kontrolü ARAYÜZ içindir; gerçek karar `assign_user_roles` RPC'sinde
  // verilir. Bu blok atlansa bile sunucu reddeder.
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

  const kullaniciSec = (id: string) => {
    setSekme('kisiler')
    setSecili(id)
    setTikli([...(data?.assignments[id] ?? [])])
    setBilgi('')
  }

  const tikleDegistir = (kod: string) =>
    setTikli(o => o.includes(kod) ? o.filter(k => k !== kod) : [...o, kod])

  const kaydet = async () => {
    if(!secili) return
    setKaydediliyor(true); setHata(''); setBilgi('')
    try {
      await saveUserRoles(secili, tikli)
      await yukle()
      // ⚠️ Yeni yetkiler BİR SONRAKİ GİRİŞTE işler: izinler oturum açılırken
      // okunuyor. Söylemeseydik yönetici "kaydettim ama olmadı" derdi.
      setBilgi('Roller kaydedildi. Kullanıcı yeni yetkileriyle BİR SONRAKİ GİRİŞİNDE çalışmaya başlar.')
    } catch (e) {
      setHata((e as Error).message)
    } finally { setKaydediliyor(false) }
  }

  const rolIzinleri = data?.rolIzinleri ?? {}
  const roller = assignableRolesFor(
    data?.roles ?? [],
    currentUser.role === 'Admin' ? 'admin' : 'personel',
  )
  const rolAdlari: Record<string, string> = Object.fromEntries(
    (data?.roles ?? []).map(r => [r.code, r.name || r.code]),
  )
  const seciliKullanici = data?.users.find(u => u.id === secili) ?? null

  const degisti = secili
    ? JSON.stringify([...tikli].sort()) !== JSON.stringify([...(data?.assignments[secili] ?? [])].sort())
    : false

  // ⚠️ Önizleme TİKLENEN rollere göre hesaplanıyor, kayıtlı olana göre değil:
  // yönetici kaydetmeden ÖNCE ne vereceğini görsün. Yetki dağıtmak, sonucu
  // görülmeden yapılacak bir iş değil.
  const onizlemeRoller = seciliKullanici
    ? [seciliKullanici.primaryRoleCode, ...tikli].filter(Boolean)
    : []
  const onizlemeIzinleri = seciliKullanici
    ? etkinIzinler(seciliKullanici.primaryRoleCode, tikli, rolIzinleri)
    : []
  const onizlemeAlanlar = alanAgaci(onizlemeIzinleri, {
    roller: onizlemeRoller, rolIzinleri, rolAdlari,
  })
  const onizlemeKritik = kritikYetkiler(onizlemeIzinleri)
  const onizlemeOnay = onayYetkileri(onizlemeIzinleri, data?.onayAdimlari ?? [])

  // ── TÜMDENGELİM: rol kataloğu ───────────────────────────────────────────
  const rolDugumleri: RolDugumu[] = rolAgaci(roller, rolIzinleri)
  const acikRol = rolDugumleri.find(r => r.kod === seciliRol) ?? null

  /** Bu rolü taşıyan kişiler — "verdiğim rol kimlerde" sorusu. */
  const rolTasiyanlar = (rolKodu: string) => (data?.users ?? [])
    .filter(u => u.primaryRoleCode === rolKodu || (data?.assignments[u.id] ?? []).includes(rolKodu))
    .map(u => ({
      id: u.id,
      ad: u.fullName || u.username,
      birincil: u.primaryRoleCode === rolKodu,
    }))

  return (
    <div className="users-page">
      <div className="page-title">
        <div>
          <h2>Kullanıcılar ve Yetkiler</h2>
          <p className="muted">
            Bir kişi birden çok rol taşıyabilir; etkin yetkisi hepsinin
            <strong> toplamıdır</strong>. Rol seçmek "ya o ya bu" değil, tikleme işidir.
          </p>
        </div>
      </div>

      <div className="form-actions">
        <button
          className={`btn ${sekme === 'kisiler' ? 'primary' : ''}`}
          type="button" onClick={() => setSekme('kisiler')}
        >
          Kişiler ({(data?.users ?? []).length})
        </button>
        <button
          className={`btn ${sekme === 'roller' ? 'primary' : ''}`}
          type="button" onClick={() => setSekme('roller')}
        >
          Roller ve yetkileri ({rolDugumleri.length})
        </button>
      </div>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-success">{bilgi}</div>}
      {durum === 'yukleniyor' && <section className="card empty-state">Yükleniyor…</section>}

      {durum === 'hazir' && sekme === 'roller' && (
        <div className="roller-layout">
          <section className="card">
            <div className="section-header compact">
              <h3>Roller</h3>
              <p className="muted">
                Bir rol seçin; o rolün hangi alanlarda ne yapabildiği aşağıda
                açılır. Alanı açınca tek tek yetkileri görürsünüz.
              </p>
            </div>
            <ul className="rol-listesi">
              {rolDugumleri.map(r => (
                <li key={r.kod}>
                  <button
                    type="button"
                    className={`rol-satiri${r.kod === seciliRol ? ' secili' : ''}`}
                    onClick={() => setSeciliRol(r.kod === seciliRol ? null : r.kod)}
                  >
                    <strong>{r.ad}</strong>
                    <span className="muted">
                      {r.alanlar.length} alan · {r.izinSayisi} yetki
                      {r.saltOkur && ' · yalnız okur'}
                    </span>
                    {r.kritikSayisi > 0 && (
                      <span className="onem-rozeti kritik">{r.kritikSayisi} kritik</span>
                    )}
                  </button>
                </li>
              ))}
              {rolDugumleri.length === 0 && (
                <li className="muted">Veritabanında rol bulunamadı.</li>
              )}
            </ul>
          </section>

          <section className="card">
            {!acikRol && (
              <div className="empty-state">
                Soldan bir rol seçin — depocu, muhasebeci, nakliyeci, hangisi
                olursa. Seçtiğiniz rolün hangi alanlarda iş yapabildiği, her
                alanda tek tek neyi yapabildiği ve o rolü bugün kimlerin
                taşıdığı burada açılır.
              </div>
            )}

            {acikRol && (() => {
              const tasiyanlar = rolTasiyanlar(acikRol.kod)
              return (<>
                <div className="section-header compact">
                  <h3>{acikRol.ad}</h3>
                  {acikRol.aciklama && <p className="muted">{acikRol.aciklama}</p>}
                  <p className="muted">{rolCumlesi(acikRol)}</p>
                </div>

                {acikRol.saltOkur && (
                  <div className="form-info">
                    <strong>Bu rol hiçbir şeyi değiştiremez.</strong> Her şeyi
                    görür, hiçbir kayda dokunamaz — denetçi, danışman ve mali
                    müşavir için uygun olan budur.
                  </div>
                )}

                {acikRol.kritikSayisi > 0 && (
                  <div className="form-error">
                    <strong>Bu rol {acikRol.kritikSayisi} kritik yetki taşıyor.</strong>{' '}
                    Kritik dediğimiz şeyler yanlış kişide olursa en pahalıya
                    patlayanlar: mal çıkarmak, sipariş onaylamak, irsaliye
                    kesmek, yetki dağıtmak. Aşağıda kırmızı işaretli satırlar.
                  </div>
                )}

                <h4>Bu rol ne yapabilir</h4>
                {/* key: rol değişince açık alanlar sıfırlanır. */}
                <YetkiAgaci key={acikRol.kod} alanlar={acikRol.alanlar} />

                <h4>Bu rolü taşıyanlar</h4>
                {tasiyanlar.length === 0 && (
                  <p className="muted">Bu rol şu anda kimsede yok.</p>
                )}
                {tasiyanlar.length > 0 && (
                  <ul className="rol-tasiyanlar">
                    {tasiyanlar.map(k => (
                      <li key={k.id}>
                        <button type="button" className="baglanti-dugmesi" onClick={() => kullaniciSec(k.id)}>
                          {k.ad}
                        </button>
                        {k.birincil
                          ? <span className="muted"> — birincil rolü</span>
                          : <span className="muted"> — ek rol</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {/*
                  ⚠️ Eksik olanı SÖYLÜYORUZ. Rolün içindeki tek bir izni
                  açıp kapatacak bir yer YOK; aradığı ayarı bulamayan
                  kullanıcı, yanlış yerde arar.
                */}
                <div className="form-info">
                  <strong>Rolün içeriği buradan değiştirilemez.</strong> Roller
                  sistem genelinde sabittir: "depocuya bir de şunu ver" diye tek
                  bir yetki eklenemez. Kişiye rol EKLENİR ya da ÇIKARILIR —
                  Kişiler sekmesinden. İşletmeye özel rol tanımlama yol
                  haritasında duruyor.
                </div>
              </>)
            })()}
          </section>
        </div>
      )}

      {durum === 'hazir' && sekme === 'kisiler' && (
        <div className="users-layout">
          <section className="card users-main">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th><th>Birincil rol</th><th>Ek roller</th>
                    <th>Kritik yetki</th><th>Aktif</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users ?? []).map(u => {
                    const ek = data?.assignments[u.id] ?? []
                    const izin = etkinIzinler(u.primaryRoleCode, ek, rolIzinleri)
                    const kritik = kritikYetkiler(izin)
                    return (
                      <tr key={u.id} className={u.id === secili ? 'secili' : undefined}>
                        <td>
                          <strong>{u.fullName || u.username}</strong>
                          <br /><span className="muted">{u.username}</span>
                        </td>
                        <td>{rolAdlari[u.primaryRoleCode] || u.primaryRoleCode || '—'}</td>
                        <td className="muted">
                          {ek.length ? ek.map(k => rolAdlari[k] || k).join(', ') : '—'}
                        </td>
                        <td>
                          {/* Kritik yetkiler listede de görünüyor: yöneticinin
                              "kimde mal çıkarma var" sorusunu her kullanıcıyı
                              tek tek açmadan cevaplayabilmesi gerekiyor. */}
                          {kritik.length === 0
                            ? <span className="muted">—</span>
                            : <span className="onem-rozeti kritik">{kritik.length}</span>}
                        </td>
                        <td>{u.isActive ? 'Evet' : <span className="is-critical">Pasif</span>}</td>
                        <td className="row-actions">
                          <button className="btn" type="button" onClick={() => kullaniciSec(u.id)}>
                            Yetkilerini aç ›
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {(data?.users ?? []).length === 0 && (
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
              sonra kişi bu listede görünür ve rolleri buradan verilir.
              Davetle açma akışı yol haritasında duruyor.
            </div>
          </section>

          <aside className="users-side">
            {!seciliKullanici && (
              <section className="card empty-state">
                Soldan bir kullanıcı seçin. Seçtiğinizde ne yapabildiğini,
                hangi sipariş onaylarını verebildiğini ve rollerini
                göreceksiniz.
              </section>
            )}

            {seciliKullanici && (
              <section className="card">
                <div className="section-header compact">
                  <h3>{seciliKullanici.fullName || seciliKullanici.username}</h3>
                  <p className="muted">
                    Birincil rol:{' '}
                    <strong>
                      {rolAdlari[seciliKullanici.primaryRoleCode]
                        || seciliKullanici.primaryRoleCode || '—'}
                    </strong>
                    {degisti && <> · <span className="is-critical">kaydedilmemiş değişiklik var</span></>}
                  </p>
                </div>

                {onizlemeKritik.length > 0 && (
                  <div className="form-error">
                    <strong>Kritik yetkiler:</strong>
                    <ul>{onizlemeKritik.map(c => <li key={c}>{c}</li>)}</ul>
                  </div>
                )}

                <h4>Ne yapabilir</h4>
                <p className="muted">
                  Alan başlığına basın, o alanda tek tek neyi yapabildiği
                  açılır. Her satırın altında yetkinin HANGİ ROLDEN geldiği
                  yazıyor — geri almak için hangi tiki kaldıracağınız belli olsun.
                </p>
                {/* key: kişi ya da tikler değişince açık alanlar sıfırlanır. */}
                <YetkiAgaci
                  key={`${seciliKullanici.id}:${[...tikli].sort().join(',')}`}
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

                <h4>Roller</h4>
                <p className="muted">
                  Tikler birincil rolün ÜZERİNE eklenir. Yukarıdaki ağaç
                  tiklediğiniz hâle göre anında güncellenir — kaydetmeden önce
                  ne vereceğinizi görürsünüz.
                </p>
                <div className="role-checkbox-grid">
                  {roller.map(r => {
                    // ⚠️ Rolün TAMAMI değil, EKLEYECEĞİ gösteriliyor: izinlerin
                    // yarısı kişide zaten olabilir. "Bu rolü eklesem ne olur"
                    // sorusunun cevabı fark, toplam değil.
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
                    disabled={kaydediliyor || !degisti}
                    onClick={() => void kaydet()}
                  >
                    {kaydediliyor ? 'Kaydediliyor…' : 'Rolleri kaydet'}
                  </button>
                  <button
                    className="btn" type="button"
                    onClick={() => { setSekme('roller'); setSeciliRol(seciliKullanici.primaryRoleCode) }}
                  >
                    Birincil rolü incele
                  </button>
                  <button className="btn" type="button" onClick={() => setSecili(null)}>Kapat</button>
                </div>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
