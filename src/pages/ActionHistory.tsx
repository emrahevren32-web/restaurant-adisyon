import React from 'react'
import { ActionLog, ActionLogType } from '../types'
import { loadActionLogs, loadUsers } from '../storage'

const operationTypes: ActionLogType[] = [
  'Masa oluşturuldu',
  'Masa silindi',
  'Masa adı değiştirildi',
  'Masa açıldı',
  'Sipariş eklendi',
  'Sipariş silindi',
  'Ürün adedi artırıldı',
  'Ürün adedi azaltıldı',
  'İndirim uygulandı',
  'İndirim kaldırıldı',
  'İkram eklendi',
  'Masa taşındı',
  'Masa birleştirildi',
  'Sipariş Hazırlanıyor',
  'Sipariş Hazır',
  'Görevli çağrıldı',
  'Görevli Çağrısı Sahiplenildi',
  'Görevli Çağrısı Masaya Gidildi',
  'Görevli Çağrısı Kapatıldı',
  'Dijital Talep Oluşturuldu',
  'Dijital Talep Düzenlendi',
  'Dijital Talep Notu Güncellendi',
  'Dijital Talep Onaylandı',
  'Dijital Talep Reddedildi',
  'Hesap kapatıldı',
  'Ürün oluşturuldu',
  'Ürün güncellendi',
  'Ürün aktif yapıldı',
  'Ürün pasif yapıldı',
  'Kategori oluşturuldu',
  'Kategori güncellendi',
  'Kategori aktif yapıldı',
  'Kategori pasif yapıldı',
  'Stok kartı oluşturuldu',
  'Stok kartı güncellendi',
  'Stok kartı silindi',
  'Stok kartı aktif yapıldı',
  'Stok kartı pasif yapıldı',
  'Stok kategorisi oluşturuldu',
  'Stok kategorisi güncellendi',
  'Stok kategorisi aktif yapıldı',
  'Stok kategorisi pasif yapıldı',
  'Stok girişi yapıldı',
  'Stok çıkışı yapıldı',
  'Stok sayım düzeltmesi yapıldı',
  'Stok ters hareketi oluşturuldu',
  'Kritik stok uyarısı oluştu',
  'Kritik stoktan çıkıldı',
  'SKT lotu oluşturuldu',
  'SKT lotu tüketildi',
  'SKT lotu iade edildi',
  'SKT lotu güncellendi',
  'SKT yaklaşan uyarısı oluştu',
  'SKT tarihi geçti',
  'SKT lot eşleşmesi yapılamadı',
  'Kayıp kaydı oluşturuldu',
  'Kayıp kaydı terslendi',
  'Kayıp lottan düşüldü',
  'Geçerlilik nedeniyle kayıp oluşturuldu',
  'Üretim Tanımı oluşturuldu',
  'Üretim Tanımı güncellendi',
  'Üretim Tanımı silindi',
  'Üretim Tanımı kopyalandı',
  'Üretim Tanımı aktif yapıldı',
  'Üretim Tanımı pasif yapıldı',
  'Otomatik stok düşümü yapıldı',
  'Otomatik stok düşümü terslendi',
  'Otomatik stok düşümü uyarısı',
  'Otomatik stok düşümü başarısız',
  'Kullanıcı oluşturuldu',
  'Kullanıcı güncellendi',
  'Kullanıcı aktif yapıldı',
  'Kullanıcı pasif yapıldı',
  'Kullanıcı pasife alındı',
  'Kullanıcı silindi',
  'Şifre sıfırlandı',
  'Lisans kullanıcıya atandı',
  'Şube oluşturuldu',
  'Şube güncellendi',
  'Şube silindi',
  'Şube aktif yapıldı',
  'Şube pasif yapıldı',
  'Şube değiştirildi',
  'Veri şubeye bağlandı',
  'Transfer oluşturuldu',
  'Transfer onaylandı',
  'Transfer tamamlandı',
  'Transfer iptal edildi',
  'Şube yetkisi oluşturuldu',
  'Şube yetkisi güncellendi',
  'Şube yetkisi silindi',
  'Cari oluşturuldu',
  'Cari güncellendi',
  'Cari aktif yapıldı',
  'Cari pasif yapıldı',
  'Cari silindi',
  'Veresiye oluşturuldu',
  'Veresiye güncellendi',
  'Tahsilat girildi',
  'Veresiye kapatıldı',
  'Veresiye silindi',
  'Tahsilat oluşturuldu',
  'Tahsilat güncellendi',
  'Tahsilat silindi',
  'Tedarikçi borcu oluşturuldu',
  'Tedarikçi borcu güncellendi',
  'Tedarikçi ödemesi girildi',
  'Tedarikçi borcu kapatıldı',
  'Tedarikçi borcu silindi',
  'Tedarikçi ödemesi oluşturuldu',
  'Tedarikçi ödemesi silindi',
  'Kasa hareketi oluşturuldu',
  'Kasa hareketi silindi',
  'Gelir kaydı oluşturuldu',
  'Gelir kaydı güncellendi',
  'Gelir kaydı silindi',
  'Gider kaydı oluşturuldu',
  'Gider kaydı güncellendi',
  'Gider kaydı silindi',
  'Gün sonu kasa kapatıldı',
  'Kasa devri oluşturuldu',
  'Kasa devri silindi',
  'Personel oluşturuldu',
  'Personel güncellendi',
  'Personel pasif yapıldı',
  'Personel silindi',
  'Vardiya oluşturuldu',
  'Vardiya güncellendi',
  'Vardiya tamamlandı',
  'Vardiya iptal edildi',
  'Vardiya silindi',
  'Puantaj oluşturuldu',
  'Puantaj güncellendi',
  'Puantaj silindi',
  'Performans kaydı oluşturuldu',
  'Performans kaydı güncellendi',
  'Performans kaydı silindi',
  'Prim oluşturuldu',
  'Prim güncellendi',
  'Prim onaylandı',
  'Prim ödendi',
  'Prim iptal edildi',
  'Prim silindi',
  'Denetim kaydı oluşturuldu',
  'Denetim kaydı güncellendi',
  'Denetim kaydı silindi',
  'İşletme başvurusu oluşturuldu',
  'İşletme başvurusu onaylandı',
  'İşletme başvurusu reddedildi',
  'İşletme başvurusu güncellendi',
  'Başvuru oluşturuldu',
  'Başvuru incelendi',
  'Başvuru onaylandı',
  'Başvuru reddedildi',
  'Firma otomatik oluşturuldu',
  'Tenant otomatik oluşturuldu',
  'Lisans otomatik oluşturuldu',
  'Firma oluşturuldu',
  'Admin kullanıcı oluşturuldu',
  'Kurulum tamamlandı',
  'Paket oluşturuldu',
  'Paket güncellendi',
  'Paket pasife alındı',
  'Lisans atandı',
  'Lisans yenilendi',
  'Lisans askıya alındı',
  'Lisans iptal edildi',
  'Modül aktif edildi',
  'Modül pasif edildi',
  'Firma modülü güncellendi',
  'Lisans erişim kontrolü başarısız'
]

operationTypes.push(
  'Tenant oluşturuldu',
  'Tenant güncellendi',
  'Tenant pasife alındı',
  'Tenant aktif edildi',
  'Tenant arşivlendi',
  'Tenant erişimi engellendi',
  'Veri izolasyonu doğrulandı'
)

const getNeutralActionText = (value: string) => value
  .replace(/Masa/g, 'Alan')
  .replace(/masa/g, 'alan')
  .replace(/Sipariş/g, 'Talep')
  .replace(/sipariş/g, 'talep')
  .replace(/Adisyon/g, 'İşlem')
  .replace(/adisyon/g, 'işlem')
  .replace(/QR Menü/g, 'Dijital Katalog')
  .replace(/QR Siparişi/g, 'Dijital Talep')
  .replace(/QR Sipariş/g, 'Dijital Talep')
  .replace(/Garson/g, 'Görevli')
  .replace(/garson/g, 'görevli')
  .replace(/SKT/g, 'Geçerlilik')
  .replace(/Fire/g, 'Kayıp')
  .replace(/fire/g, 'kayıp')
  .replace(/Reçete/g, 'Üretim Tanımı')
  .replace(/reçete/g, 'üretim tanımı')

export default function ActionHistory(){
  const [logs] = React.useState<ActionLog[]>(() => loadActionLogs())
  const [users] = React.useState(() => loadUsers())
  const [dateFilter, setDateFilter] = React.useState('')
  const [userFilter, setUserFilter] = React.useState('all')
  const [operationFilter, setOperationFilter] = React.useState<'all' | ActionLogType>('all')

  const userOptions = React.useMemo(() => {
    const seen = new Set<string>()
    const fromLogs = logs
      .filter(log => {
        if(seen.has(log.userId)) return false
        seen.add(log.userId)
        return true
      })
      .map(log => ({ id: log.userId, name: log.userName }))

    const fromUsers = users.map(user => ({ id: user.id, name: user.fullName || user.username }))
    const merged = [...fromUsers, ...fromLogs]
    const unique = new Map(merged.map(user => [user.id, user]))
    return Array.from(unique.values()).filter(user => user.id)
  }, [logs, users])

  const filteredLogs = logs.filter(log => {
    const matchesDate = !dateFilter || log.date === dateFilter
    const matchesUser = userFilter === 'all' || log.userId === userFilter
    const matchesOperation = operationFilter === 'all' || log.operationType === operationFilter
    return matchesDate && matchesUser && matchesOperation
  })

  return (
    <div className="action-history-page">
      <div className="page-title">
        <div>
          <h2>İşlem Geçmişi</h2>
          <p className="muted">Sistemde yapılan kritik işlemleri kullanıcı, tarih ve işlem tipine göre inceleyin.</p>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Log Kayıtları</h3>
            <p className="muted">{filteredLogs.length} kayıt gösteriliyor.</p>
          </div>
          <div className="action-log-filters">
            <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
            <select value={userFilter} onChange={e=>setUserFilter(e.target.value)}>
              <option value="all">Tüm kullanıcılar</option>
              {userOptions.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={operationFilter} onChange={e=>setOperationFilter(e.target.value as 'all' | ActionLogType)}>
              <option value="all">Tüm işlemler</option>
              {operationTypes.map(type => <option key={type} value={type}>{getNeutralActionText(type)}</option>)}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Saat</th>
                <th>Kullanıcı</th>
                <th>İşlem</th>
                <th>Alan</th>
                <th>Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">Filtrelere uygun işlem kaydı bulunamadı.</td></tr>
              )}
              {filteredLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.date}</td>
                  <td>{log.time}</td>
                  <td>{log.userName}</td>
                  <td>{getNeutralActionText(log.operationType)}</td>
                  <td>{getNeutralActionText(log.tableName || '-')}</td>
                  <td>{getNeutralActionText(log.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
