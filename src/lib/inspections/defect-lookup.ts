/**
 * Mapping z surowego tekstu zalecenia (np. z `previous_recommendations.recommendation_text`)
 * do nazwy defektu z `defect_library.name_pl` po `recommendation_template`.
 *
 * Używane w rendererze tabeli III aby w sekcji „Zaobserwowane defekty z poprzedniej
 * kontroli" wyświetlać NAZWĘ DEFEKTU zamiast tekstu zalecenia (które już jest
 * widoczne w kolumnie Zalecenia jako carry-over „Z poprzedniej kontroli: …").
 *
 * Importy archiwum często wprowadzają zaśmiecone teksty z sufiksami typu
 * `(NB) - stopień pilności III` lub prefiksami `[1. Fundament i posadowienie]`,
 * dlatego match nie może być dokładny — normalizujemy oba teksty (text i
 * template) przed porównaniem.
 */

/**
 * Usuwa typowe „szum" z tekstu zalecenia:
 *  - prefiks `[N. Nazwa elementu]` (z importu archiwalnego)
 *  - sufiks `(K)/(NB)/(NG) - stopień pilności [I-IV]` (typ + pilność)
 *  - sufiks samego `(K)/(NB)/(NG)` bez pilności
 *  - sufiks `- stopień pilności [I-IV]` bez typu robót
 *  - whitespace + diakrytyki znormalizowane do NFC
 */
export function normalizeRecommendationText(raw: string | null | undefined): string {
  if (!raw) return ''
  let text = raw.normalize('NFC').trim()

  // Prefiks: [N. Nazwa elementu]
  text = text.replace(/^\[\s*\d+\.\s+[^\]]+\]\s*/u, '')

  // Sufiksy w kolejności od najdłuższych do najkrótszych
  text = text.replace(
    /\s*[-–—]?\s*\(?[KNBG]+\)?\s*[-–—]\s*stopień\s+pilności\s+[IVX]+\s*$/iu,
    ''
  )
  text = text.replace(/\s*[-–—]?\s*stopień\s+pilności\s+[IVX]+\s*$/iu, '')
  text = text.replace(/\s*\(\s*(?:K|NB|NG)\s*\)\s*$/u, '')

  // Zwijanie spacji
  return text.replace(/\s+/g, ' ').trim()
}

export interface DefectLibraryRow {
  name_pl: string
  recommendation_template: string | null
  /**
   * Alternatywne wersje zalecenia z archiwalnych protokołów — match
   * w rendererze sprawdza zarówno `recommendation_template` jak i te aliasy.
   * Pole dodane migracją `2026-05-15_defect_library_archive_match_aliases`.
   */
  archive_match_aliases: string[] | null
  element_number: number | null
}

/**
 * Tokenizuje tekst zalecenia na zbiór słów (dla fuzzy matching).
 * Lowercase + usuwa interpunkcję + split whitespace + filtruje krótkie szum-tokeny.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,;:()/\\!?–—"„""']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2) // pomijamy stop-słowa „i", „w", „z"
}

/**
 * Containment score: ile słów `templateTokens` jest w `archiveTokens`.
 * Wraca 0..1. Używany jako miara podobieństwa archiwalnego tekstu zalecenia
 * do template w bibliotece — archive bywa „rozszerzony" o szczegóły (np.
 * „turbiny", „wraz z usunięciem skażeń biologicznych"), więc Jaccard daje
 * niski wynik. Containment (template ⊂ archive) lepiej oddaje fakt
 * „archive zawiera całe template + dodatki".
 */
function containmentScore(
  templateTokens: string[],
  archiveTokens: Set<string>,
): number {
  if (templateTokens.length === 0) return 0
  let matched = 0
  for (const t of templateTokens) {
    if (archiveTokens.has(t)) matched++
  }
  return matched / templateTokens.length
}

/**
 * Buduje pre-tokenized listę template'ów z biblioteki — używana w lookup.
 */
interface DefectEntry {
  name_pl: string
  /** Lista zestawów tokenów: główny template + każdy alias z archiwum. */
  tokenSets: string[][]
  /** Tokeny nazwy defektu — do tie-breakera (name_similarity). */
  nameTokens: string[]
}

export interface DefectLookup {
  byElement: Map<number | null, DefectEntry[]>
  any: Array<DefectEntry & { element_number: number | null }>
}

export function buildDefectLookup(
  rows: DefectLibraryRow[] | null | undefined,
): DefectLookup {
  const byElement = new Map<number | null, DefectEntry[]>()
  const any: Array<DefectEntry & { element_number: number | null }> = []
  for (const r of rows || []) {
    const sources: string[] = []
    const tpl = normalizeRecommendationText(r.recommendation_template)
    if (tpl) sources.push(tpl)
    for (const alias of r.archive_match_aliases || []) {
      const a = normalizeRecommendationText(alias)
      if (a) sources.push(a)
    }
    if (sources.length === 0) continue

    const tokenSets: string[][] = []
    for (const s of sources) {
      const t = tokenize(s)
      if (t.length >= 3) tokenSets.push(t)
    }
    if (tokenSets.length === 0) continue

    const nameTokens = tokenize(r.name_pl)
    const entry: DefectEntry = { name_pl: r.name_pl, tokenSets, nameTokens }
    const elem = r.element_number ?? null
    if (!byElement.has(elem)) byElement.set(elem, [])
    byElement.get(elem)!.push(entry)
    any.push({ ...entry, element_number: elem })
  }
  return { byElement, any }
}

/**
 * Fuzzy lookup nazwy defektu dla danego tekstu zalecenia.
 *
 * Strategia:
 * 1. Tokenize archive text.
 * 2. Szukaj kandydatów ograniczonych do `elementNumber` — redukcja fałszywych
 *    matchów między elementami (np. „Przyciąć roślinność" z poz. Estetyka
 *    NIE może zmatchować defektu z poz. Fundament).
 * 3. Wybierz template z najwyższym `containmentScore` ≥ threshold (0.85).
 * 4. Bez globalnego fallback — gdy w danym elemencie brak matchu, zwracamy
 *    null (informacja o niewykonanym zaleceniu pozostaje w kolumnie Zalecenia
 *    jako carry-over „Z poprzedniej kontroli:").
 *
 * @param threshold próg 0..1, domyślnie 0.85 — co najmniej 85% słów template
 *   musi być obecne w tekście archiwalnym żeby uznać za match.
 */
export function lookupDefectName(
  lookup: DefectLookup,
  recommendationText: string | null | undefined,
  elementNumber?: number | null,
  threshold = 0.85,
): string | null {
  const norm = normalizeRecommendationText(recommendationText)
  if (!norm) return null
  const archiveTokens = new Set(tokenize(norm))
  if (archiveTokens.size === 0) return null
  if (elementNumber == null) return null

  const candidates = lookup.byElement.get(elementNumber) || []
  let best: { name_pl: string; score: number; nameSim: number } | null = null
  for (const c of candidates) {
    // Każdy defekt może mieć kilka źródeł tokenów (template + aliasy z archiwum).
    // Wybieramy MAX containment z tych źródeł.
    let s = 0
    for (const ts of c.tokenSets) {
      const sc = containmentScore(ts, archiveTokens)
      if (sc > s) s = sc
    }
    if (s < threshold) continue
    // Tie-breaker: similarity nazwy defektu z tekstem zalecenia. Gdy oba mają
    // ten sam containment, wybieramy defekt którego NAZWA bardziej przypomina
    // zalecenie (więcej słów-kluczy się pokrywa).
    const nameSim = containmentScore(c.nameTokens, archiveTokens)
    if (
      !best ||
      s > best.score ||
      (s === best.score && nameSim > best.nameSim)
    ) {
      best = { name_pl: c.name_pl, score: s, nameSim }
    }
  }
  return best?.name_pl ?? null
}
