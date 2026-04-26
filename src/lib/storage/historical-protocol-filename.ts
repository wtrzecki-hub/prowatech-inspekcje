/**
 * Parser nazw plików archiwalnych protokołów PIIB ProWaTech.
 *
 * Wzorzec nazwy w GDrive `21 Prowatech-inspekcje/04 inspekcje`:
 *   {NUMER}_T_{ROK} Protokol_kontroli_{TYP} {LOKALIZACJA} {DD-MM-YYYY}[.pdf]
 *
 * gdzie:
 *   - NUMER          = liczba (numer wewnętrzny ProWaTech)
 *   - T              = literalnie "T"
 *   - ROK            = 4-cyfrowy rok kontroli
 *   - TYP            = "rocznej" | "5-letniej"
 *   - LOKALIZACJA    = oznaczenie turbiny + farma + miejscowość
 *                      (różne formaty — nie parseujemy strukturalnie,
 *                       wrzucamy do `notes` jako tekst pomocniczy)
 *   - DD-MM-YYYY     = data kontroli
 *
 * Przykłady:
 *   "92_T_2025 Protokol_kontroli_5-letniej EW Żałe I 06-05-2025"
 *   "73_T_2025 Protokol_kontroli_rocznej EW Żałe 06-05-2025"
 *   "310_T_2025 Protokół_kontroli_rocznej WTG S-01 Potęgowo_Malechowo Sulechówko 03-09-2025"
 *   "467_T_2025 Protokol_kontroli_rocznej EW 1_ 18-12-2025"
 *
 * Obsługa różnych wariantów:
 *   - "Protokol" i "Protokół" (z/bez akcentu)
 *   - case-insensitive
 *   - rozszerzenie .pdf opcjonalne (parser akceptuje obie wersje)
 *
 * Jeśli nazwa nie pasuje do wzorca — wszystkie pola zwracają null
 * i admin uzupełnia formularz ręcznie.
 */

export interface ParsedHistoricalFilename {
  protocolNumber: string | null;        // "92/T/2025"
  year: number | null;                  // 2025
  inspectionType: "annual" | "five_year" | null;
  inspectionDate: string | null;        // ISO YYYY-MM-DD
  location: string | null;              // środkowa część ("EW Żałe I")
}

/**
 * Parsuje nazwę pliku archiwalnego protokołu.
 *
 * @param filename Pełna nazwa pliku (z rozszerzeniem albo bez)
 * @returns Obiekt z polami parseowanymi (każde może być null jeśli nie matchuje wzorca)
 */
export function parseHistoricalProtocolFilename(
  filename: string
): ParsedHistoricalFilename {
  const empty: ParsedHistoricalFilename = {
    protocolNumber: null,
    year: null,
    inspectionType: null,
    inspectionDate: null,
    location: null,
  };

  if (!filename || typeof filename !== "string") return empty;

  // Strip extension (.pdf, .PDF, etc.)
  const nameWithoutExt = filename.replace(/\.[^./\\]+$/, "");

  // Główny regex:
  //   ^(\d+)            — numer protokołu
  //   _T_
  //   (\d{4})           — rok
  //   \s+
  //   Protok[oó]l       — Protokol / Protokół
  //   _kontroli_
  //   (rocznej|5-letniej)   — typ
  //   \s+
  //   (.+?)             — lokalizacja (lazy, do daty)
  //   \s+
  //   (\d{2})-(\d{2})-(\d{4})  — DD-MM-YYYY
  //   $
  const regex =
    /^(\d+)_T_(\d{4})\s+Protok[oó]l_kontroli_(rocznej|5-letniej)\s+(.+?)\s+(\d{2})-(\d{2})-(\d{4})$/i;

  const match = nameWithoutExt.match(regex);
  if (!match) return empty;

  const [, num, yearStr, typeStr, location, day, month, dateYear] = match;

  // Walidacja wartości
  const year = parseInt(yearStr, 10);
  const dayN = parseInt(day, 10);
  const monthN = parseInt(month, 10);

  if (year < 2010 || year > 2050) return empty;
  if (monthN < 1 || monthN > 12) return empty;
  if (dayN < 1 || dayN > 31) return empty;

  // Dodatkowo waliduj że dateYear pasuje do year ± 1 rok (tolerancja na styczniowe protokoły z grudnia)
  const dateYearN = parseInt(dateYear, 10);
  if (Math.abs(dateYearN - year) > 1) {
    // nieprawdopodobne — data kontroli nie pasuje do roku w numerze, zostawiamy null dla daty
    return {
      protocolNumber: `${num}/T/${yearStr}`,
      year,
      inspectionType: typeStr.toLowerCase() === "rocznej" ? "annual" : "five_year",
      inspectionDate: null,
      location: location.trim() || null,
    };
  }

  return {
    protocolNumber: `${num}/T/${yearStr}`,
    year,
    inspectionType: typeStr.toLowerCase() === "rocznej" ? "annual" : "five_year",
    inspectionDate: `${dateYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    location: location.trim() || null,
  };
}

/**
 * Sprawdza czy parser w ogóle wyciągnął cokolwiek z nazwy.
 */
export function hasAnyParsedField(parsed: ParsedHistoricalFilename): boolean {
  return Boolean(
    parsed.protocolNumber ||
      parsed.year ||
      parsed.inspectionType ||
      parsed.inspectionDate ||
      parsed.location
  );
}
