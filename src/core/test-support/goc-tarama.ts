// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Test desteği — göç dosyalarını tarama
//
// Bazı kriterler tek bir dosyaya bakarak kanıtlanamaz. "İşletmenin TÜM
// verisi yedeğe giriyor" bunlardan biri: bugün doğru olsa bile yarın
// eklenecek bir tablo onu sessizce yanlış hâle getirir. Gerçeğin kaynağı
// `db/migrations` — bu yüzden testler oraya bakıyor.
//
// `stock-write-gate.arch.test.ts` ile aynı kalıp: kriteri yoruma değil
// TESTE bağlamak.
//
// ⚠️ EN KÖTÜ SONUÇ "HİÇ DOSYA BULAMADIM" DEYİP SESSİZCE GEÇMEKTİR.
// O yüzden kök bulunamazsa açıkça patlıyor, ayrıca testlerde bir sağlama
// var: taramanın gerçekten tablo bulduğu ayrıca iddia ediliyor.
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const projeKokunuBul = (): string => {
  let dizin = process.cwd()
  for(let i = 0; i < 6; i++){
    if(existsSync(join(dizin, 'db', 'migrations'))) return dizin
    const ust = join(dizin, '..')
    if(ust === dizin) break
    dizin = ust
  }
  throw new Error(
    'Proje kökü bulunamadı (db/migrations aranıyordu). ' +
    'Bu test göç dosyalarını okuyabilmek için köke ihtiyaç duyuyor.',
  )
}

/** Bütün göç dosyaları, numara sırasına göre birleştirilmiş. */
export const gocMetni = (): string => {
  const dizin = join(projeKokunuBul(), 'db', 'migrations')
  // ⚠️ Açık tip: tip kontrolünde node tipleri yoksa `d` any olur ve derleme durur.
  const dosyalar = (readdirSync(dizin) as string[])
    .filter((d: string) => d.endsWith('.sql')).sort()
  if(dosyalar.length === 0) throw new Error('db/migrations boş görünüyor.')
  return dosyalar.map((d: string) => readFileSync(join(dizin, d), 'utf8') as string).join('\n')
}

/**
 * `create table` gövdelerini tablo adına göre döndürür.
 *
 * Parantez dengesi sayılarak kesiliyor; düz bir regex iç içe parantezleri
 * (`numeric(12,3)`, `check (... in (...))`) yanlış yerden keser.
 */
export const tabloGovdeleri = (sql: string): Map<string, string> => {
  const govdeler = new Map<string, string>()
  const re = /create table (?:if not exists )?(?:public\.)?([a-z_]+)\s*\(/g
  let m: RegExpExecArray | null
  while((m = re.exec(sql)) !== null){
    const ad = m[1]
    let derinlik = 0
    for(let j = m.index + m[0].length - 1; j < sql.length; j++){
      if(sql[j] === '(') derinlik += 1
      else if(sql[j] === ')'){
        derinlik -= 1
        if(derinlik === 0){
          const parca = sql.slice(m.index, j)
          govdeler.set(ad, (govdeler.get(ad) ?? '') + parca)
          break
        }
      }
    }
  }
  return govdeler
}

/** `tenant_id` kolonu taşıyan tablolar — yani işletmeye ait veri. */
export const kiraciTablolari = (sql = gocMetni()): string[] =>
  [...tabloGovdeleri(sql).entries()]
    .filter(([, govde]) => /\btenant_id\b/.test(govde))
    .map(([ad]) => ad)
    .sort()

/**
 * `do $$ ... $$;` blokları.
 *
 * Göçlerin çoğu RLS ve izinleri döngü içinde `execute format(...)` ile
 * kuruyor. Yalnız düz `alter table` satırlarını aramak, o tabloları
 * "RLS'i yok" sanmaya yol açar — bu testi yazarken tam bu yanlışa düştüm.
 */
const doBloklari = (sql: string): string[] => {
  const out: string[] = []
  const re = /do \$\$([\s\S]*?)\$\$\s*;/g
  let m: RegExpExecArray | null
  while((m = re.exec(sql)) !== null) out.push(m[1])
  return out
}

/** Gövdesinde `anahtar` geçen DO bloklarındaki dizi elemanları. */
const dongudeGecenler = (sql: string, anahtar: RegExp): Set<string> => {
  const bulunan = new Set<string>()
  for(const blok of doBloklari(sql)){
    if(!anahtar.test(blok)) continue
    const re = /array\s*\[([\s\S]*?)\]/g
    let m: RegExpExecArray | null
    while((m = re.exec(blok)) !== null){
      for(const ad of m[1].match(/'([a-z_]+)'/g) ?? []){
        bulunan.add(ad.replace(/'/g, ''))
      }
    }
  }
  return bulunan
}

/** RLS'i açılmış tablolar — düz satırla ya da döngüyle. */
export const rlsAcikTablolar = (sql = gocMetni()): Set<string> => {
  const acik = new Set<string>()
  const re = /alter table (?:public\.)?([a-z_]+)\s+enable row level security/gi
  let m: RegExpExecArray | null
  while((m = re.exec(sql)) !== null) acik.add(m[1])
  for(const t of dongudeGecenler(sql, /enable row level security/i)) acik.add(t)
  return acik
}

/**
 * Denetim kaydı tetikleyicisinin izlediği tablolar (0027).
 *
 * Gerçeğin kaynağı göçtür, koddaki bir liste değil: tetikleyici orada
 * kuruluyor.
 */
export const denetimIzlenenTablolar = (sql = gocMetni()): string[] => {
  const m = /izlenecek text\[\] := array\[([\s\S]*?)\]/.exec(sql)
  if(!m) throw new Error(
    '0027 içindeki izlenen tablo listesi bulunamadı. ' +
    'Liste taşındıysa bu tarayıcı da güncellenmeli — yoksa test sessizce zayıflar.',
  )
  return (m[1].match(/'([a-z_]+)'/g) ?? [])
    .map(s => s.replace(/'/g, ''))
    .sort()
}
