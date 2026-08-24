/**
 * Tanımlayıcı normalleştirme — şube kodu, kullanıcı adı, SKU gibi alanlar için.
 *
 * Türkçe yerel ayarıyla küçültme burada KULLANILAMAZ. Sebebi noktalı/noktasız i:
 *
 *   'ISTANBUL'.toLocaleLowerCase('tr-TR')  →  'ıstanbul'   (noktasız ı)
 *   'istanbul'.toLocaleLowerCase('tr-TR')  →  'istanbul'
 *
 * İkisi eşleşmez. Sonuç: aynı kodla iki şube, aynı adla iki kullanıcı açılabilir.
 * Bu bir görüntü hatası değil, veri bütünlüğü hatasıdır.
 *
 * Bu yüzden tanımlayıcılar yerel ayardan bağımsız karşılaştırılır ve dört i
 * varyantı (i, ı, I, İ) tek harfe katlanır.
 *
 * Bu fonksiyon GÖRÜNEN METİN için değildir. Ad, etiket, açıklama sıralaması ve
 * gösterimi hâlâ Türkçe yerel ayarını kullanmalıdır.
 */
export const normalizeIdentifier = (value: string) => (
  value
    .trim()
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
)

/** İki tanımlayıcı aynı kaydı mı gösteriyor? */
export const isSameIdentifier = (first: string, second: string) => (
  normalizeIdentifier(first) === normalizeIdentifier(second)
)
