import React from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, type AppIconProps } from '../design-system/IconSystem'

export type ProductTourStep = {
  key: string
  title: React.ReactNode
  description: React.ReactNode
  target?: string
  icon?: AppIconProps['name']
  badge?: React.ReactNode
}

export type ProductTourProviderProps = {
  open: boolean
  steps: ProductTourStep[]
  activeIndex: number
  welcome?: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: () => void
  className?: string
}

export type TourStepProps = {
  step: ProductTourStep
  activeIndex: number
  total: number
  welcome?: boolean
  ready?: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: () => void
}

export type FeatureHighlightTone = 'info' | 'success' | 'warning' | 'danger'

export type FeatureHighlightProps = {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  icon?: AppIconProps['name']
  tone?: FeatureHighlightTone
  actions?: React.ReactNode
  className?: string
}

export type GettingStartedStep = {
  key: string
  label: React.ReactNode
  done?: boolean
}

export type GettingStartedCardProps = {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: AppIconProps['name']
  steps?: GettingStartedStep[]
  actionLabel?: React.ReactNode
  badge?: React.ReactNode
  disabled?: boolean
  onAction?: () => void
  className?: string
}

export type QuickTipProps = {
  title?: React.ReactNode
  children: React.ReactNode
  icon?: AppIconProps['name']
  tone?: FeatureHighlightTone | 'neutral'
  dismissible?: boolean
  className?: string
}

const getReducedMotion = () => (
  document.documentElement.dataset.motionPreference === 'reduced'
  || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
)

const getTargetSelector = (target: string) => `[data-onboarding-target="${target}"]`
const getTourDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-')

type TourPlacement = 'center' | 'bottom' | 'top' | 'right' | 'left'

/** Buzlamanın DIŞINDA kalacak dikdörtgen — ekran koordinatı, piksel. */
export type TourHole = { top: number; right: number; bottom: number; left: number }

type TourCardLayout = {
  placement: TourPlacement
  style: React.CSSProperties
  hole?: TourHole
}

/**
 * Rehber ile `AppShell` arasındaki tek sözleşme: yan menüyü geçici olarak aç.
 *
 * Yan menü dar (rail) moddayken yalnızca ikonlar görünür ve fareyle üzerine
 * gelince açılır. Rehberin "Sidebar" adımında kapalı bir menüyü göstermek
 * anlamsız — anlatılan şey görünmüyor. Menünün açık/kapalı durumu `AppShell`
 * içinde React state; rehber ona doğrudan erişemez.
 *
 * Bu yüzden bir olayla haber veriliyor: rehber "aç" der, adım bitince "kapat".
 * Menü zaten sabitlenmişse `AppShell` bunu yok sayar — kullanıcının tercihi
 * bozulmaz.
 */
export const SIDEBAR_PEEK_EVENT = 'miyop:tour-sidebar-peek'

/** Yan menüyü hedefleyen adımın anahtarı (`OnboardingExperience` ile aynı). */
const SIDEBAR_TARGET = 'side-menu'

const setSidebarPeek = (acik: boolean) => {
  window.dispatchEvent(new CustomEvent(SIDEBAR_PEEK_EVENT, { detail: acik }))
}

/** Kartın köşeden uzaklığı. */
const TOUR_CARD_MARGIN = 24

/** Vurgulanan alanın çevresinde buzlamadan bırakılan pay — kenarlık payı. */
const TOUR_HOLE_PADDING = 8

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KART ARTIK GEZMİYOR — ve bu bilinçli bir geri adım.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Kartı hedefin yanına koymayı beş kez denedim; her seferinde başka bir adım
 * kırıldı. Denenenler ve neden yetmedikleri:
 *
 *   1) Kartın ÖLÇÜLEN genişliğiyle hesap  → ölçüm adım geçişlerinde yanılıyor
 *   2) `overflow-y:auto` ile taşma kontrolü → yatay kaydırma kabı doğurdu,
 *      metin kırpıldı ("l Paneli")
 *   3) CSS `clamp()` ile kırpma           → üst sınır kart genişliğini bilmeyi
 *      gerektiriyor, o da temaya göre değişiyor
 *   4) Portal + kenardan hizalama         → sağ kenar düzeldi, başka adımlar
 *      bozuldu
 *   5) `scrollIntoView(inline:'center')`  → sayfayı yatayda kaydırıp hedefi
 *      kartın altından çekiyordu
 *
 * Ortak kök sebep: hedefin yanına koymak, hedefin kutusunu + kartın kutusunu +
 * ekranı + kaydırma durumunu AYNI ANDA doğru bilmeyi gerektiriyor. Bu dört
 * bilginin her biri ayrı ayrı yanılabiliyor ve uygulamada 10 adım × her ekran
 * boyu kadar ihtimal var. Kapatılamayacak kadar geniş bir yüzey.
 *
 * ── ŞİMDİKİ KARAR ────────────────────────────────────────────────────────
 * Kart SABİT bir köşede durur. Hiçbir şey ölçülmez, dolayısıyla hiçbir şey
 * yanılamaz. İşaret etme işini kart değil, BUZLAMADAKİ DELİK ve hedefin
 * çevresindeki çerçeve yapar — ve o kısım çalışıyor.
 *
 * Tek kural: hedef ekranın alt yarısındaysa kart sağ ÜSTE, değilse sağ ALTA
 * gider. Yoksa kart, tanıttığı şeyin üstüne oturur. İki konum var, ikisi de
 * köşeye iki kenardan yapışık (`right` + `top`/`bottom`); bir kutu iki kenardan
 * içeride duruyorsa taşması matematiksel olarak imkânsızdır — kart ne kadar
 * geniş ya da yüksek olursa olsun.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const SAG_ALT: React.CSSProperties = {
  left: 'auto',
  right: `${TOUR_CARD_MARGIN}px`,
  top: 'auto',
  bottom: `${TOUR_CARD_MARGIN}px`,
  transform: 'none'
}

const SAG_UST: React.CSSProperties = {
  left: 'auto',
  right: `${TOUR_CARD_MARGIN}px`,
  top: `${TOUR_CARD_MARGIN}px`,
  bottom: 'auto',
  transform: 'none'
}

/**
 * Hedefi olmayan (ya da hedefi sayfada bulunamayan) adım.
 *
 * "Hazırsınız" adımının hedefi yoktur — kapanış metnidir. Eskiden bu durumda
 * `style: {}` dönüyordu ve CSS kartı sağ alt köşeye atıyordu; ekranda
 * vurgulanan bir şey olmadığı için de her yer buzlanıyordu. Dışarıdan "popup
 * bozuk" görünüyordu, oysa gösterilecek bir yer yoktu.
 */
const ORTA_YERLESIM: TourCardLayout = {
  placement: 'center',
  style: {
    left: '50%',
    right: 'auto',
    top: '50%',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)'
  }
}

const getViewportBoundedLayout = (target: Element | null): TourCardLayout => {
  if(!target) return ORTA_YERLESIM

  const hedef = target.getBoundingClientRect()
  // `clientWidth/Height` kaydırma çubuğunu dışarıda bırakır; `innerWidth` ve
  // `100vw` bırakmaz. Delik hesabında bu fark kenarda hataya yol açıyordu.
  const ekranGenisligi = document.documentElement.clientWidth
  const ekranYuksekligi = document.documentElement.clientHeight

  const hedefDikeyMerkezi = hedef.top + (hedef.height / 2)
  const hedefAltYarida = hedefDikeyMerkezi > ekranYuksekligi / 2

  return {
    placement: 'center',
    style: hedefAltYarida ? SAG_UST : SAG_ALT,
    hole: {
      top: Math.max(0, hedef.top - TOUR_HOLE_PADDING),
      left: Math.max(0, hedef.left - TOUR_HOLE_PADDING),
      right: Math.min(ekranGenisligi, hedef.right + TOUR_HOLE_PADDING),
      bottom: Math.min(ekranYuksekligi, hedef.bottom + TOUR_HOLE_PADDING)
    }
  }
}

/**
 * Buzlamayı tek bir örtü yerine DÖRT ŞERİT olarak çizer.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Vurgulanan öge eskiden `z-index: 151` ile örtünün ÜSTÜNE çıkıyordu. Rehber
 * portal ile `document.body` altına taşınınca bu bitti: artık iki öge farklı
 * yığınlama bağlamlarında ve uygulamanın içindeki hiçbir `z-index` gövde
 * seviyesindeki örtüyü geçemez. Sonuç: tanıtılan yer de buzlanıyordu.
 *
 * `z-index` yarışını kazanmaya çalışmak yerine örtüyü hedefin çevresinden
 * dolaştırıyoruz — hedefin üstünde çizilecek bir şey kalmıyor. Bu çözüm
 * yığınlama bağlamından, tema efektlerinden ve `backdrop-filter`dan tamamen
 * bağımsız; kırılacak bir varsayımı yok.
 */
const TourScrim = ({ hole }: { hole?: TourHole }) => {
  if(!hole) return <div className="product-tour-scrim" />

  const yukseklik = document.documentElement.clientHeight
  const genislik = document.documentElement.clientWidth

  const seritler: React.CSSProperties[] = [
    // üst
    { top: 0, left: 0, right: 0, bottom: `${Math.round(yukseklik - hole.top)}px` },
    // alt
    { top: `${Math.round(hole.bottom)}px`, left: 0, right: 0, bottom: 0 },
    // sol
    { top: `${Math.round(hole.top)}px`, bottom: `${Math.round(yukseklik - hole.bottom)}px`, left: 0, right: `${Math.round(genislik - hole.left)}px` },
    // sağ
    { top: `${Math.round(hole.top)}px`, bottom: `${Math.round(yukseklik - hole.bottom)}px`, left: `${Math.round(hole.right)}px`, right: 0 }
  ]

  return (
    <>
      {seritler.map((stil, sira) => (
        <div className="product-tour-scrim" key={sira} style={{ inset: 'auto', ...stil }} />
      ))}
    </>
  )
}

const clearHighlights = () => {
  document.querySelectorAll('.product-tour-highlight').forEach(element => {
    element.classList.remove('product-tour-highlight')
  })
}

export const TourStep = ({
  step,
  activeIndex,
  total,
  welcome = false,
  ready = false,
  onBack,
  onNext,
  onSkip,
  onFinish
}: TourStepProps) => {
  const progressValue = total <= 1 ? 100 : Math.round(((activeIndex + 1) / total) * 100)
  const stepId = getTourDomId(step.key)
  const titleId = `product-tour-${stepId}-title`
  const descriptionId = `product-tour-${stepId}-description`

  return (
    <section
      className="product-tour-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
    >
      <div className="product-tour-card-header">
        <span className="status-pill info-pill">
          {step.badge || (welcome ? 'Hos Geldiniz' : `Adim ${activeIndex + 1}/${total}`)}
        </span>
        <button className="btn ghost product-tour-close" type="button" onClick={onSkip}>Atla</button>
      </div>
      <div className="product-tour-copy">
        <span className="product-tour-icon" aria-hidden="true">
          <AppIcon name={step.icon || 'help'} size="MD" />
        </span>
        <div>
          <h3 id={titleId}>{step.title}</h3>
          <p id={descriptionId}>{step.description}</p>
        </div>
      </div>
      {!welcome && (
        <div className="product-tour-progress" role="progressbar" aria-label="Tur ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressValue}>
          <span style={{ width: `${progressValue}%` }} />
        </div>
      )}
      <div className="product-tour-actions">
        {!welcome && (
          <button className="btn" type="button" onClick={onBack}>
            Geri
          </button>
        )}
        {ready ? (
          <button className="btn primary" type="button" onClick={onFinish}>
            Bitir
          </button>
        ) : (
          <button className="btn primary" type="button" onClick={onNext}>
            {welcome ? 'Rehberi Baslat' : 'Devam Et'}
          </button>
        )}
      </div>
    </section>
  )
}

export const ProductTourProvider = ({
  open,
  steps,
  activeIndex,
  welcome,
  onBack,
  onNext,
  onSkip,
  onFinish,
  className = ''
}: ProductTourProviderProps) => {
  const activeStep = steps[activeIndex] || steps[0]
  const cardRef = React.useRef<HTMLDivElement | null>(null)
  const [cardLayout, setCardLayout] = React.useState<TourCardLayout>({ placement: 'center', style: {} })
  const ready = activeIndex >= steps.length - 1

  React.useEffect(() => {
    if(!open) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if(event.key === 'Escape') onSkip()
      if(event.key === 'ArrowRight') onNext()
      if(event.key === 'ArrowLeft' && !welcome) onBack()
    }

    document.addEventListener('keydown', onKeyDown)
    window.setTimeout(() => {
      const tourCard = cardRef.current?.querySelector<HTMLElement>('.product-tour-card')
      ;(tourCard || cardRef.current)?.focus()
    }, 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onBack, onNext, onSkip, open, welcome])

  React.useEffect(() => {
    clearHighlights()
    if(!open || welcome){
      setCardLayout({ placement: 'center', style: {} })
      return undefined
    }

    const targetSelector = activeStep?.target ? getTargetSelector(activeStep.target) : ''
    const getTarget = () => targetSelector ? document.querySelector(targetSelector) : null
    let frame = 0
    let settleTimer = 0

    const updateLayout = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setCardLayout(getViewportBoundedLayout(getTarget()))
      })
    }

    // Yan menü adımıysa menüyü aç; adım değişince ya da rehber kapanınca
    // aşağıdaki temizlikte tekrar kapanıyor.
    const yanMenuAdimi = activeStep?.target === SIDEBAR_TARGET
    if(yanMenuAdimi) setSidebarPeek(true)

    const timer = window.setTimeout(() => {
      const target = getTarget()

      // Adım bir hedef bildiriyor ama o öge sayfada yoksa, bu bir REHBER
      // HATASIDIR — yerleşim hatası değil. Sessiz kalırsa köşeye düşen bir
      // kart olarak görünür ve saatlerce yanlış yerde aranır ("Widget Alanı"
      // adımında tam olarak bu oldu). Bu yüzden adıyla söylüyor.
      if(targetSelector && !target && import.meta.env?.DEV){
        console.warn(
          `[MİYOP rehber] "${activeStep?.key}" adımının hedefi sayfada yok: `
          + `${targetSelector} — kart ekranın ortasında gösterilecek.`
        )
      }

      target?.classList.add('product-tour-highlight')

      // ── KAYDIRMA: EN AZ MÜDAHALE ────────────────────────────────────
      // Önceden `inline: 'center'` kullanılıyordu. Bu, hedefi YATAYDA da
      // ortalamaya çalışır: sağ üstteki profil ya da bildirim düğmesi gibi
      // kenardaki bir hedefte tarayıcı, yatayda kaydırılabilen ilk üst kabı
      // bulup kaydırır. Sayfa o sırada altından kayar; kart ekrana sabit
      // durduğu için hedefin yanından ayrılır, hedef de kenara sıvanır.
      // Dışarıdan bakınca "popup yine kaydı" görünür — oysa kayan sayfaydı.
      //
      // Artık: hedef zaten tamamen görünüyorsa HİÇ kaydırmıyoruz; gerekiyorsa
      // yalnızca dikeyde ve `inline: 'nearest'` ile — yatayda zaten görünen
      // bir ögeyi 'nearest' oynatmaz.
      const hedefKutusu = target?.getBoundingClientRect()
      const ekraniDolduruyor = Boolean(
        hedefKutusu && hedefKutusu.height >= window.innerHeight * 0.9
      )
      const tamamenGorunuyor = Boolean(
        hedefKutusu
        && hedefKutusu.top >= 0
        && hedefKutusu.left >= 0
        && hedefKutusu.bottom <= document.documentElement.clientHeight
        && hedefKutusu.right <= document.documentElement.clientWidth
      )
      if(target && !ekraniDolduruyor && !tamamenGorunuyor){
        target.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: getReducedMotion() ? 'auto' : 'smooth'
        })
      }
      updateLayout()
      settleTimer = window.setTimeout(updateLayout, getReducedMotion() ? 0 : 240)
    }, getReducedMotion() ? 0 : 160)

    window.addEventListener('resize', updateLayout)
    window.addEventListener('scroll', updateLayout, true)

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(settleTimer)
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('scroll', updateLayout, true)
      if(yanMenuAdimi) setSidebarPeek(false)
      clearHighlights()
    }
  }, [activeStep, open, welcome])

  React.useEffect(() => {
    if(open) return undefined
    clearHighlights()
    return undefined
  }, [open])

  if(!open || !activeStep) return null

  // ── ASIL SEBEP: KART UYGULAMANIN İÇİNDE RENDER EDİLİYORDU ───────────────
  // Rehber `AppShell`'in içinde duruyordu. `position: fixed` normalde EKRANA
  // göre konumlanır — ama üst ögelerden birinde `transform`, `filter`,
  // `backdrop-filter`, `contain` ya da `will-change` varsa, tarayıcı referansı
  // ekrandan O ÖGEYE çevirir. AppShell'in cam/bulanıklık efektleri tam olarak
  // bunu yapıyordu.
  //
  // Sonuç: `getBoundingClientRect()` ekran koordinatı veriyor, `100vw` ekran
  // genişliğini ölçüyor, ama kart bambaşka bir kutuya göre yerleşiyordu. Sayfa
  // yatayda da kaydırılabilir olduğu için fark büyüyor ve kart ekranın dışına
  // taşıyordu. Konum hesabını üç kez düzelttim; hiçbiri işe yaramadı çünkü
  // hesap zaten doğruydu — YANLIŞ OLAN, hesabın uygulandığı yerdi.
  //
  // Portal, rehberi doğrudan `document.body` altına taşıyor. Artık üstünde
  // hiçbir öge yok, `fixed` gerçekten ekrana göre çalışıyor ve `100vw` ile
  // `getBoundingClientRect()` aynı şeyden bahsediyor.
  //
  // Yan kazanç: kart sayfa kaydırmasından etkilenmiyor. Hedef ekranın altında
  // kalsa bile (`scrollIntoView` onu ortaya getiriyor) kart hep görünür kalıyor.
  return createPortal(
    <div className={['product-tour-shell', welcome ? 'welcome' : 'guided', className].filter(Boolean).join(' ')} role="presentation">
      <TourScrim hole={welcome ? undefined : cardLayout.hole} />
      <div ref={cardRef} tabIndex={-1} data-tour-placement={cardLayout.placement} style={welcome ? undefined : cardLayout.style}>
        <TourStep
          step={activeStep}
          activeIndex={activeIndex}
          total={steps.length}
          welcome={welcome}
          ready={ready}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onFinish={onFinish}
        />
      </div>
    </div>,
    document.body
  )
}

export const FeatureHighlight = ({
  title,
  description,
  badge = "What's New",
  icon = 'info',
  tone = 'info',
  actions,
  className = ''
}: FeatureHighlightProps) => (
  <section className={['feature-highlight', `tone-${tone}`, className].filter(Boolean).join(' ')}>
    <span className="feature-highlight-icon" aria-hidden="true">
      <AppIcon name={icon} size="MD" />
    </span>
    <div className="feature-highlight-copy">
      <span>{badge}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="feature-highlight-actions">{actions}</div>}
  </section>
)

export const GettingStartedCard = ({
  title,
  description,
  icon = 'workspace',
  steps = [],
  actionLabel,
  badge,
  disabled = false,
  onAction,
  className = ''
}: GettingStartedCardProps) => (
  <article className={['getting-started-card', disabled ? 'disabled' : '', className].filter(Boolean).join(' ')}>
    <div className="getting-started-card-header">
      <span className="getting-started-card-icon" aria-hidden="true">
        <AppIcon name={icon} size="MD" />
      </span>
      {badge && <span className="getting-started-card-badge">{badge}</span>}
    </div>
    <div className="getting-started-card-copy">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
    {steps.length > 0 && (
      <ul className="getting-started-steps">
        {steps.map(step => (
          <li className={step.done ? 'done' : ''} key={step.key}>
            <span aria-hidden="true">{step.done && <AppIcon name="success" size="XS" />}</span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ul>
    )}
    {actionLabel && (
      <button className="btn primary" type="button" disabled={disabled || !onAction} onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </article>
)

export const QuickTip = ({
  title = 'Quick Tip',
  children,
  icon = 'help',
  tone = 'info',
  dismissible = false,
  className = ''
}: QuickTipProps) => {
  const [visible, setVisible] = React.useState(true)
  if(!visible) return null

  return (
    <aside className={['quick-tip', `tone-${tone}`, className].filter(Boolean).join(' ')} role="note">
      <span className="quick-tip-icon" aria-hidden="true">
        <AppIcon name={icon} size="SM" />
      </span>
      <div className="quick-tip-copy">
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
      {dismissible && (
        <button className="quick-tip-close" type="button" aria-label="Ipucunu kapat" onClick={() => setVisible(false)}>
          <AppIcon name="close" size="XS" />
        </button>
      )}
    </aside>
  )
}

export default ProductTourProvider
