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
  'Garson çağrıldı',
  'Garson Çağrısı Sahiplenildi',
  'Garson Çağrısı Masaya Gidildi',
  'Garson Çağrısı Kapatıldı',
  'QR Siparişi Oluşturuldu',
  'QR Siparişi Düzenlendi',
  'QR Sipariş Notu Güncellendi',
  'QR Siparişi Onaylandı',
  'QR Siparişi Reddedildi',
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
  'Fire kaydı oluşturuldu',
  'Fire kaydı terslendi',
  'Fire lottan düşüldü',
  'SKT nedeniyle fire oluşturuldu',
  'Reçete oluşturuldu',
  'Reçete güncellendi',
  'Reçete silindi',
  'Reçete kopyalandı',
  'Reçete aktif yapıldı',
  'Reçete pasif yapıldı',
  'Otomatik stok düşümü yapıldı',
  'Otomatik stok düşümü terslendi',
  'Otomatik stok düşümü uyarısı',
  'Otomatik stok düşümü başarısız',
  'Kullanıcı oluşturuldu',
  'Kullanıcı güncellendi',
  'Kullanıcı aktif yapıldı',
  'Kullanıcı pasif yapıldı',
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
  'Vardiya silindi'
]

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
              {operationTypes.map(type => <option key={type} value={type}>{type}</option>)}
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
                <th>Masa</th>
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
                  <td>{log.operationType}</td>
                  <td>{log.tableName || '-'}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
