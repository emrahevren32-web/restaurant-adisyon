import { LoginRouteTarget } from '../routing/routing.types'
import {
  authenticateUser,
  getCurrentUser,
  setCurrentUser
} from '../storage'
import { loadPermissionsForUser } from '../authorization/permission.repository'
import { syncWorkspaceCompanyFromDatabase } from '../companies/company-bridge'
import { User } from '../types'
import { SessionModel } from '../session/session.types'
import { TenantContextModel } from '../tenant/tenant.types'
import { AuthorizationContext } from '../authorization/authorization.types'
import { JwtDescriptor } from './jwt.types'
import {
  evaluateAuthenticationPipelineTarget,
  resolveAuthenticationPipeline
} from './authentication-pipeline'
import { AuthenticationPipelineResult } from './authentication-pipeline.types'
import { AuthenticationContext, createAuthenticationContext } from './authentication.context'

export type AuthenticationState = {
  currentUser: User | null
  context: AuthenticationContext
  session: SessionModel | null
  jwt: JwtDescriptor | null
  tenantContext: TenantContextModel
  authorization: AuthorizationContext
  pipeline: AuthenticationPipelineResult
}

export type AuthenticationServiceOptions = {
  requestedPath?: string
  requestedTarget?: LoginRouteTarget | string
}

export type AuthenticationLoginResult = {
  success: boolean
  user: User | null
  state: AuthenticationState
}

export const getInitialAuthenticationState = (
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  return createAuthenticationState(getCurrentUser(), options)
}

/**
 * `app_user.role_code` → uygulamanın `Role` tipi eşlemesi.
 *
 * `storage.ts` içindeki `authenticateUser` bunun tersini yapıyor
 * (`role_code === 'admin' ? 'Admin' : 'Personel'`), yani rol kodu `User`
 * nesnesine ulaşana kadar kayboluyor. İzinleri veritabanından okumak için
 * kod tekrar gerekiyor — bu yüzden burada geri çevriliyor.
 *
 * `super_admin` (0014) bugün `Role` tipinde karşılığı olmadığı için `Admin`e
 * düşer; platform yüzeyi ayrıştığında (Aşama 4+) bu eşleme genişletilecek.
 */
const roleCodeOf = (user: User): string => {
  // 2026-08-29: artık TAHMİN ETMİYORUZ. `app_user.role_code` giriş sırasında
  // `User.roleCode` alanına taşınıyor; varsa doğrudan o kullanılır.
  //
  // Öncesinde kod `Admin` → 'admin' diye geri üretiliyordu ve bu sessiz bir
  // hataydı: `super_admin` ya da `isletme_sahibi` giriş yaptığında izinleri
  // kendi rolünden değil `admin` rolünden yükleniyordu. Rol çerçevesinin
  // (0015) tamamı bu tek satırda etkisizleşiyordu.
  if(user.roleCode) return user.roleCode
  // Eski oturumlar / Supabase dışı akışlar için kaba karşılık.
  return user.role === 'Admin' ? 'admin' : 'personel'
}

export const authenticateCredentials = async (
  email: string,
  password: string,
  options: AuthenticationServiceOptions = {}
): Promise<AuthenticationLoginResult> => {
  const user = await authenticateUser(email, password)

  if(!user){
    return { success: false, user: null, state: createAuthenticationState(null, options) }
  }

  // Aşama 1 · İzinler VERİTABANINDAN okunur (0014/0015). Daha önce
  // `role.service.ts` içindeki sabit `DEFAULT_ROLES` dizisinden geliyorlardı.
  // Etkin küme: birincil rol ∪ `user_role`'daki ek roller (0015 — bir kişi
  // birden çok departman rolü taşıyabilir).
  const permissions = await loadPermissionsForUser(user.id, roleCodeOf(user))

  // `null` = izinler OKUNAMADI (ağ/RLS hatası) — "izni yok" ile aynı şey değil.
  // Yarım yetkili bir oturum açmak yerine giriş reddedilir: hangi ekranları
  // görmesi gerektiğini bilmediğimiz bir kullanıcıyı içeri almak, ona rastgele
  // bir yetki kümesi atamak demektir. Fail-closed.
  if(permissions === null){
    setCurrentUser(null)
    return { success: false, user: null, state: createAuthenticationState(null, options) }
  }

  const authorizedUser: User = { ...user, permissions }
  // Sayfa yenilendiğinde `getCurrentUser()` izinleriyle birlikte dönsün diye
  // yeniden kaydediliyor (`authenticateUser` izinsiz hâlini kaydetmişti).
  setCurrentUser(authorizedUser)

  // Firma köprüsü — kullanıcının firmasını veritabanından okuyup localStorage
  // modeline aynalar. Bunsuz `getPrimarySectorIdForUser()` boş dönüyor ve
  // sektöre bağlı HİÇBİR iş modülü menüde üretilmiyor. Gerekçenin tamamı:
  // src/companies/company-bridge.ts dosya başı.
  //
  // `setCurrentUser`'dan SONRA çağrılıyor: köprü `loadCompanies()` üzerinden
  // kiracı süzmesi yapıyor ve o süzme `getCurrentUser()`'a bakıyor.
  await syncWorkspaceCompanyFromDatabase(authorizedUser)

  const state = createAuthenticationState(authorizedUser, options)

  return {
    success: true,
    user: authorizedUser,
    state
  }
}

export const createAuthenticationState = (
  user: User | null,
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  const pipeline = resolveAuthenticationPipeline({
    legacyUser: user,
    requestedPath: options.requestedPath,
    requestedTarget: options.requestedTarget
  })

  return {
    currentUser: user,
    context: createAuthenticationContext(pipeline, pipeline.sessionModel),
    session: pipeline.sessionModel,
    jwt: pipeline.jwt,
    tenantContext: pipeline.tenantContext,
    authorization: pipeline.authorization,
    pipeline
  }
}

export const evaluateAuthenticationStateTarget = (
  state: AuthenticationState,
  target: LoginRouteTarget | string
): AuthenticationState => {
  const pipeline = evaluateAuthenticationPipelineTarget(state.pipeline, target)

  return {
    ...state,
    context: createAuthenticationContext(pipeline, state.session),
    tenantContext: pipeline.tenantContext,
    authorization: pipeline.authorization,
    pipeline
  }
}

export const logoutAuthentication = (
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  setCurrentUser(null)
  return createAuthenticationState(null, options)
}
