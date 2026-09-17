// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Ekran çökme sınırı
//
// Bir ekran çizilirken hata fırlarsa React o ağacı söker; sınır olmasa bütün
// uygulama beyaz ekrana düşer. Bu sınır çökmeyi tek ekranda tutar.
//
// ── AŞAMA 4'TE DEĞİŞEN İKİ ŞEY ────────────────────────────────────────────
// 1. ÇÖKME ARTIK BİR YERE YAZILIYOR. Önce yalnızca ekrana bir kutu çiziyordu;
//    hata hiçbir yere düşmüyordu, yani biz hiç öğrenmiyorduk. Şimdi
//    `client_error` tablosuna gidiyor (0030).
// 2. HAM HATA MESAJI ARTIK GÖSTERİLMİYOR. Önce `error.message` müşteri
//    ekranına basılıyordu. O metin dosya adı, alan adı, bazen veri parçası
//    taşır — "müşterinin görmemesi gereken" şeydir. Yerine bir REFERANS
//    NUMARASI gösteriyoruz: müşteri onu bize söyler, biz kaydı buluruz.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import {
  clearDecisionIndexedRecords,
  isDecisionStorageError
} from '../read-model/decision-indexed-storage.service'
import { hataBildirici } from '../errors/reporter'

type RouteErrorBoundaryProps = {
  boundaryKey: string
  routeLabel: string
  children: React.ReactNode
}

type RouteErrorBoundaryState = {
  hasError: boolean
  isStorageError: boolean
  /** Kayda ulaşmayı sağlayan kısa etiket. Ham hata metni DEĞİL. */
  referans: string
}

const TEMIZ: RouteErrorBoundaryState = {
  hasError: false, isStorageError: false, referans: ''
}

export default class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = TEMIZ

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return {
      hasError: true,
      isStorageError: isDecisionStorageError(error),
      referans: ''
    }
  }

  componentDidCatch(error: unknown, bilgi?: React.ErrorInfo) {
    if(isDecisionStorageError(error)){
      clearDecisionIndexedRecords()
    }
    // ⚠️ Beklenmiyor (await yok) ve hatası yutuluyor: bir çökmeyi raporlamak
    // yeni bir çökme üretmemeli (error-report.ts, Kural 1).
    hataBildirici()
      .bildir(error, {
        tur: 'crash',
        yol: this.props.boundaryKey,
        tarayici: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
        ek: {
          ekran: this.props.routeLabel,
          bilesenYigini: bilgi?.componentStack?.slice(0, 1000) ?? undefined
        }
      })
      .then(referans => { this.setState({ referans }) })
      .catch(() => { /* Kural 1 */ })
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if(previousProps.boundaryKey !== this.props.boundaryKey && this.state.hasError){
      this.setState(TEMIZ)
    }
  }

  render() {
    if(!this.state.hasError) return this.props.children

    return (
      <section className="card route-error-card" role="alert">
        <span>{this.state.isStorageError ? 'Önbellek temizlendi' : 'Bu ekran açılamadı'}</span>
        <h2>{this.props.routeLabel || 'Ekran açılamadı'}</h2>
        <p>
          {this.state.isStorageError
            ? 'Bu ekranın önbelleği bozulmuştu, temizlendi. Sayfayı yeniden açabilirsiniz.'
            : 'Bu ekran beklenmeyen bir durumla karşılaştı ve güvenli moda alındı. Verilerinize bir şey olmadı; diğer menüler çalışmaya devam ediyor.'}
        </p>
        <p className="muted">
          Sorun sürerse şu numarayı bize iletin:{' '}
          <strong>{this.state.referans || 'kaydediliyor…'}</strong>
        </p>
      </section>
    )
  }
}
