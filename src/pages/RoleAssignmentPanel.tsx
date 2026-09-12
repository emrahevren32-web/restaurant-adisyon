// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 1 — Rol atama paneli ("roller tiklenmeli")
//
// Kullanıcılar ekranının (route: 'users') altındaki bölüm. `system-users` ve
// `system-roles` menü ögelerinin ikisi de bu rotaya çıkıyor.
//
// ── NEDEN AYRI BİR LİSTE ──────────────────────────────────────────────────
// Üstteki kullanıcı tablosu hâlâ `storage.ts`'in localStorage listesinden
// besleniyor (Dilim 1'de gerçek veriye bağlanacak). Bu panel ise `app_user`
// tablosundan okur, çünkü rol ataması GERÇEK bir veritabanı kaydıdır —
// localStorage'daki sahte kullanıcılara rol atamak, ekranda görünenle
// veritabanında olanın ayrışması demek olurdu.
//
// İki liste aynı ekranda geçici olarak yan yana duruyor. Panel bunu gizlemiyor,
// başlığında açıkça yazıyor.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { User } from '../types'
import {
  loadRoleAssignmentData,
  saveUserRoles,
  canAssignRoles,
  assignableRolesFor,
  SupabaseNotConfiguredError,
  type RoleAssignmentData,
} from '../authorization/role-assignment.repository'

type Props = { currentUser: User }

export default function RoleAssignmentPanel({ currentUser }: Props){
  const [data, setData] = React.useState<RoleAssignmentData | null>(null)
  const [durum, setDurum] = React.useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor')
  const [hata, setHata] = React.useState('')
  const [secili, setSecili] = React.useState<string | null>(null)
  const [tikli, setTikli] = React.useState<string[]>([])
  const [kaydediliyor, setKaydediliyor] = React.useState(false)
  const [bilgi, setBilgi] = React.useState('')

  const yetkili = canAssignRoles(currentUser.permissions)

  const yukle = React.useCallback(async () => {
    setDurum('yukleniyor')
    setHata('')
    try {
      setData(await loadRoleAssignmentData())
      setDurum('hazir')
    } catch (e) {
      setHata(e instanceof SupabaseNotConfiguredError
        ? e.message
        : `Rol verileri yüklenemedi: ${(e as Error).message}`)
      setDurum('hata')
    }
  }, [])

  React.useEffect(() => { if(yetkili) void yukle() }, [yetkili, yukle])

  // Yetki kontrolü ARAYÜZ içindir; gerçek karar `assign_user_roles` RPC'sinde
  // verilir. Bu blok atlansa bile sunucu reddeder.
  if(!yetkili){
    return (
      <section className="card">
        <div className="section-header compact"><h3>Rol Atama</h3></div>
        <p className="muted">
          Rol atamak için kullanıcı veya rol yönetimi yetkisi gerekir.
        </p>
      </section>
    )
  }

  const kullaniciSec = (userId: string) => {
    setSecili(userId)
    setTikli([...(data?.assignments[userId] ?? [])])
    setBilgi('')
    setHata('')
  }

  const tikleDegistir = (roleCode: string) => {
    setTikli(prev => prev.includes(roleCode)
      ? prev.filter(c => c !== roleCode)
      : [...prev, roleCode])
    setBilgi('')
  }

  const kaydet = async () => {
    if(!secili) return
    setKaydediliyor(true)
    setHata('')
    setBilgi('')
    try {
      // TAM DEĞİŞİM: o kullanıcının tüm tikleri gönderilir, fark değil.
      await saveUserRoles(secili, tikli)
      setData(prev => prev
        ? { ...prev, assignments: { ...prev.assignments, [secili]: [...tikli] } }
        : prev)
      setBilgi('Roller kaydedildi. Kullanıcı bir sonraki girişinde yeni yetkileriyle çalışacak.')
    } catch (e) {
      setHata((e as Error).message)
    } finally {
      setKaydediliyor(false)
    }
  }

  if(durum === 'yukleniyor'){
    return (
      <section className="card">
        <div className="section-header compact"><h3>Rol Atama</h3></div>
        <p className="muted">Yükleniyor…</p>
      </section>
    )
  }

  if(durum === 'hata' && !data){
    return (
      <section className="card">
        <div className="section-header compact"><h3>Rol Atama</h3></div>
        <div className="form-error">{hata}</div>
        <div className="form-actions">
          <button className="btn" type="button" onClick={() => void yukle()}>Tekrar Dene</button>
        </div>
      </section>
    )
  }

  const roller = assignableRolesFor(data?.roles ?? [], currentUser.role === 'Admin' ? 'admin' : 'personel')
  const seciliKullanici = data?.users.find(u => u.id === secili) ?? null
  const degisti = secili
    ? JSON.stringify([...tikli].sort()) !== JSON.stringify([...(data?.assignments[secili] ?? [])].sort())
    : false

  return (
    <section className="card">
      <div className="section-header compact">
        <h3>Rol Atama</h3>
      </div>
      <p className="muted">
        Bu bölüm veritabanındaki gerçek kullanıcıları listeler. Bir kullanıcı birden
        çok rol taşıyabilir; etkin yetkisi hepsinin toplamıdır. Rollerin ne açtığını
        <code> docs/yetki-cercevesi.md</code> dosyasından görebilirsiniz.
      </p>

      {hata && <div className="form-error">{hata}</div>}
      {bilgi && <div className="form-success">{bilgi}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Kullanıcı</th><th>Birincil Rol</th><th>Ek Roller</th><th>Aktif</th><th></th></tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map(u => {
              const ek = data?.assignments[u.id] ?? []
              return (
                <tr key={u.id} className={u.id === secili ? 'is-selected' : undefined}>
                  <td>{u.fullName || u.username}</td>
                  <td>{u.primaryRoleCode}</td>
                  <td>{ek.length ? ek.join(', ') : '—'}</td>
                  <td>{u.isActive ? 'Evet' : 'Hayır'}</td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => kullaniciSec(u.id)}>
                      Rolleri Düzenle
                    </button>
                  </td>
                </tr>
              )
            })}
            {(data?.users ?? []).length === 0 && (
              <tr><td colSpan={5} className="muted">Veritabanında kullanıcı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {seciliKullanici && (
        <div className="role-assignment-editor">
          <h4>{seciliKullanici.fullName || seciliKullanici.username} · roller</h4>
          <p className="muted">
            Birincil rolü <strong>{seciliKullanici.primaryRoleCode}</strong>. Aşağıdaki
            roller onun üzerine EKLENİR.
          </p>

          <div className="role-checkbox-grid">
            {roller.map(r => (
              <label className="check-row" key={r.code} title={r.description}>
                <input
                  type="checkbox"
                  checked={tikli.includes(r.code)}
                  onChange={() => tikleDegistir(r.code)}
                />
                <span>
                  <strong>{r.name}</strong>
                  <small className="muted"> — {r.description}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button
              className="btn primary"
              type="button"
              disabled={kaydediliyor || !degisti}
              onClick={() => void kaydet()}
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Rolleri Kaydet'}
            </button>
            <button className="btn" type="button" onClick={() => setSecili(null)}>Kapat</button>
          </div>
        </div>
      )}
    </section>
  )
}
