// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Excel/CSV içe aktarma paneli
//
// Yol haritası maddesi: "Excel ile stok kartı ve tedarikçi içe aktarma"
//
// ── TEK BİLEŞEN, İKİ EKRAN ───────────────────────────────────────────────
// Stok kartı ile tedarikçi içe aktarma AYNI şeydir: şablon indir → dosya seç →
// ne olacağını gör → onayla. Yalnızca sütunlar ve doğrulama kuralları değişir,
// onlar da dışarıdan geliyor. İki ayrı ekran yazsaydık, birinde düzelttiğimiz
// bir davranış diğerinde eski kalırdı.
//
// ── DOSYAYI OKUYAN TEK YER BURASI ────────────────────────────────────────
// `xlsx` kütüphanesi yalnızca bu dosyada. Kurallar (core/import/sheet.ts ve
// yanındakiler) `string[][]` üzerinde çalışıyor ve xlsx'i hiç bilmiyor —
// bu yüzden testleri için gerçek bir .xlsx dosyası üretmek gerekmiyor ve
// aynı kurallar CSV'de de aynen işliyor.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import * as XLSX from 'xlsx'
import {
  sablonSatirlari,
  type IceAktarmaSonucu,
  type Onizleme,
  type SutunTanimi,
} from '../core/import/sheet'

type Props<T> = {
  /** "Stok Kartları" / "Tedarikçiler" — başlıklarda ve mesajlarda geçer. */
  varlikAdi: string
  sutunlar: readonly SutunTanimi[]
  /** İndirilecek şablonun dosya adı. */
  sablonDosyaAdi: string
  cozumle: (satirlar: unknown[][]) => Onizleme<T>
  yaz: (onizleme: Onizleme<T>) => Promise<IceAktarmaSonucu>
  /**
   * Mevcut kayıtlar güncellenebiliyor mu?
   *
   * Stok kataloğunda henüz "kalem güncelle" işlemi YOK — kodu zaten olan
   * satırlar atlanır. Bunu ekranda açıkça söylemek, kullanıcının "güncelledim
   * sanıyordum" demesinden iyidir.
   */
  guncellemeDestekli: boolean
  onBitti: () => void | Promise<void>
  onIptal: () => void
}

const hataMetni = (hata: unknown) =>
  hata instanceof Error ? hata.message : 'Dosya okunamadı.'

export function SheetImport<T>({
  varlikAdi, sutunlar, sablonDosyaAdi,
  cozumle, yaz, guncellemeDestekli, onBitti, onIptal,
}: Props<T>){
  const [dosyaAdi, setDosyaAdi] = React.useState('')
  const [onizleme, setOnizleme] = React.useState<Onizleme<T> | null>(null)
  const [sonuc, setSonuc] = React.useState<IceAktarmaSonucu | null>(null)
  const [hata, setHata] = React.useState('')
  const [calisiyor, setCalisiyor] = React.useState(false)

  const sablonIndir = () => {
    const sayfa = XLSX.utils.aoa_to_sheet(sablonSatirlari(sutunlar))
    const kitap = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(kitap, sayfa, varlikAdi.slice(0, 30))
    XLSX.writeFile(kitap, sablonDosyaAdi)
  }

  const dosyaSecildi = async (dosya: File | undefined) => {
    if(!dosya) return
    setHata(''); setSonuc(null); setOnizleme(null); setDosyaAdi(dosya.name)
    try{
      const kitap = XLSX.read(await dosya.arrayBuffer())
      const ilkSayfa = kitap.Sheets[kitap.SheetNames[0]]
      if(!ilkSayfa) throw new Error('Dosyada okunabilir bir sayfa bulunamadı.')

      // `raw: false` → hücreler Excel'de göründükleri gibi metin olarak gelir.
      // Ham okusaydık tarihler seri numarasına, "007" gibi kodlar 7'ye dönerdi.
      const satirlar = XLSX.utils.sheet_to_json<unknown[]>(ilkSayfa, {
        header: 1, raw: false, defval: '',
      })
      setOnizleme(cozumle(satirlar))
    } catch (e) { setHata(hataMetni(e)) }
  }

  const uygula = async () => {
    if(!onizleme) return
    setCalisiyor(true); setHata('')
    try{
      setSonuc(await yaz(onizleme))
      await onBitti()
    } catch (e) { setHata(hataMetni(e)) }
    finally { setCalisiyor(false) }
  }

  const yazilacak = onizleme
    ? onizleme.yeni + (guncellemeDestekli ? onizleme.guncelleme : 0)
    : 0

  return (
    <div className="stacked-form">
      <p className="muted detail-hint">
        Elinizdeki listeyi Excel (.xlsx) veya CSV olarak yükleyin. Önce ne
        olacağını göreceksiniz; onaylamadan hiçbir kayıt oluşmaz.
      </p>

      <div className="form-actions">
        <button className="btn" type="button" onClick={sablonIndir}>
          Şablon İndir
        </button>
        <label className="btn primary" style={{ cursor: 'pointer' }}>
          Dosya Seç
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => { void dosyaSecildi(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
      </div>

      {dosyaAdi !== '' && <p className="muted">Dosya: <strong>{dosyaAdi}</strong></p>}
      {hata !== '' && <div className="form-error">{hata}</div>}

      {onizleme && !sonuc && (
        <OnizlemeGorunumu
          onizleme={onizleme}
          varlikAdi={varlikAdi}
          guncellemeDestekli={guncellemeDestekli}
        />
      )}

      {sonuc && (
        <>
          <div className="form-info">
            <strong>{sonuc.eklendi}</strong> kayıt eklendi
            {sonuc.guncellendi > 0 && <>, <strong>{sonuc.guncellendi}</strong> tanesi güncellendi</>}.
          </div>
          {sonuc.basarisiz.length > 0 && (
            <>
              <p className="muted detail-hint">
                Aşağıdaki satırlar yazılamadı. Diğerleri kaydedildi — bunları
                düzeltip dosyayı yeniden yükleyebilirsiniz; ikinci denemede
                yazılanlar “zaten var” olarak geçer.
              </p>
              <div className="table-wrap">
                <table className="data-table compact">
                  <thead><tr><th>Satır</th><th>Kod</th><th>Sebep</th></tr></thead>
                  <tbody>
                    {sonuc.basarisiz.map(b => (
                      <tr key={b.satir}>
                        <td>{b.satir}</td>
                        <td>{b.kod}</td>
                        <td className="muted">{b.mesaj}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <div className="form-actions">
        <button className="btn" type="button" onClick={onIptal}>
          {sonuc ? 'Kapat' : 'İptal'}
        </button>
        {!sonuc && (
          <button
            className="btn primary" type="button"
            disabled={calisiyor || yazilacak === 0}
            onClick={() => { void uygula() }}
          >
            {calisiyor ? 'Yazılıyor…' : `${yazilacak} Kaydı Aktar`}
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Önizleme
// ═══════════════════════════════════════════════════════════════════════════

function OnizlemeGorunumu<T>({
  onizleme, varlikAdi, guncellemeDestekli,
}: {
  onizleme: Onizleme<T>
  varlikAdi: string
  guncellemeDestekli: boolean
}){
  if(onizleme.eksikSutunlar.length > 0){
    return (
      <div className="form-error">
        <p>
          <strong>Dosyada olması gereken sütunlar bulunamadı:</strong>{' '}
          {onizleme.eksikSutunlar.join(', ')}
        </p>
        <p>
          Doğru sütunları görmek için “Şablon İndir” deyip kendi verinizi o
          dosyaya yapıştırmak en kolayı.
        </p>
      </div>
    )
  }

  const hatalilar = onizleme.satirlar.filter(s => s.durum === 'HATA')

  return (
    <>
      <dl className="detail-grid">
        <dt>Yeni eklenecek</dt>
        <dd><strong>{onizleme.yeni}</strong> {varlikAdi.toLocaleLowerCase('tr-TR')}</dd>
        <dt>{guncellemeDestekli ? 'Güncellenecek' : 'Zaten var (atlanacak)'}</dt>
        <dd>
          <strong>{onizleme.guncelleme}</strong>
          {!guncellemeDestekli && onizleme.guncelleme > 0 && (
            <span className="muted">
              {' · '}Bu kodlar sistemde zaten var; üzerlerine yazılmayacak.
            </span>
          )}
        </dd>
        <dt>Okunamayan satır</dt>
        <dd className={onizleme.hatali > 0 ? 'is-critical' : 'muted'}>
          <strong>{onizleme.hatali}</strong>
        </dd>
      </dl>

      {onizleme.bilinmeyenSutunlar.length > 0 && (
        <p className="muted detail-hint">
          Şu sütunlar tanınmadı ve okunmadı:{' '}
          <strong>{onizleme.bilinmeyenSutunlar.join(', ')}</strong>. Sorun
          değilse devam edin; ama bir başlığı farklı yazdıysanız o sütundaki
          bilgi aktarılmayacak.
        </p>
      )}

      {hatalilar.length > 0 && (
        <>
          <p className="muted detail-hint">
            Aşağıdaki satırlar aktarılmayacak. Diğerleri aktarılabilir —
            bu satırları dosyada düzeltip yeniden yükleyin.
          </p>
          <div className="table-wrap">
            <table className="data-table compact">
              <thead><tr><th>Satır</th><th>Kod</th><th>Sebep</th></tr></thead>
              <tbody>
                {hatalilar.map(satir => (
                  <tr key={satir.satir}>
                    <td>{satir.satir}</td>
                    <td>{satir.kod === '' ? <span className="muted">—</span> : satir.kod}</td>
                    <td className="muted">
                      {satir.durum === 'HATA' && satir.hatalar.map((h, i) => (
                        <div key={i}>{h.alan ? `${h.alan}: ` : ''}{h.mesaj}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {onizleme.satirlar.length === 0 && (
        <p className="muted">Dosyada okunacak satır yok.</p>
      )}
    </>
  )
}
