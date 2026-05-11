# Sesja 2026-05-10 / 2026-05-11 — Wzory PIIB (dostosowanie szablonów .docx)

Branch: `claude/elegant-meninsky-b73ca3`
Worktree: `C:\prowatech-inspekcje\.claude\worktrees\elegant-meninsky-b73ca3`

## 1. Zakres sesji

Dostosowanie szablonów protokołów PIIB w katalogu `wzory_PIIB/` do realiów rynku
(budżety inspekcji 300–500 zł roczna / 1000–1500 zł 5-letnia) oraz spójności z
aplikacją generującą protokoły. Materiał referencyjny:
- `wzory_PIIB/Raport_zmian_wzory_PIIB.docx` — historia zmian
- `C:\Users\WALDEK\Downloads\003_P_2026 Protokół_kontroli_5-letniej WTG EW03 Żeńsko 30-04-2026 (2).pdf`
  — protokół referencyjny generowany przez aplikację

## 2. Stan plików `wzory_PIIB/` po sesji

```
Protokol_Kontroli_Rocznej_EW_PIIB_R.docx          — rocznik rozszerzony (z wjazdem)
Protokol_Kontroli_Rocznej_EW_PIIB_U.docx          — rocznik uproszczony (bez wjazdu)
Protokol_Kontroli_5-letniej_EW_PIIB.docx          — 5-letni połączony (default)
Protokol_Kontroli_5-letniej_EW_PIIB_O.docx        — 5-letni odrębny (osobny od rocznego)
Raport_zmian_wzory_PIIB.docx                      — zaktualizowany (sekcje 9 + 10)
```

**Skasowany w trakcie sesji:** `Protokol_Kontroli_Rocznej_EW_PIIB.docx` (oryginał bez sufiksu)
— zastąpiony przez `_R.docx`. Plik niemożliwy do odzyskania (rm w bashu nie idzie do kosza,
katalog nie był w gicie ani OneDrive).

**Skrypt generujący:** `scripts/generate_piib_templates.py` — idempotentny, można uruchomić
ponownie po edycji.

```bash
python -X utf8 scripts/generate_piib_templates.py
```

## 3. Decyzje i zmiany — chronologicznie

### 3.1. Architektura plików
- Dwa warianty rocznego: `_R` (rozszerzony) + `_U` (uproszczony, bez wjazdu)
- Jeden wariant 5-letniego + odrębny `_O` (gdy PINB wymaga osobnych protokołów)
- Konwencja nazw plików generowanych przez aplikację (`buildProtocolFilename`) bez zmian
  — odpowiada wzorowi `003_P_2026 Protokół_kontroli_5-letniej WTG EW03 Żeńsko 30-04-2026.pdf`

### 3.2. Sekcja III — tabela ustaleń
- Skala OCENA: **4-stopniowa PIIB pozostaje** (dobry/dostateczny/niedostateczny/awaryjny)
  — zgodnie z aplikacją oraz Żeńsko
- Wycięte z zakresu rocznego: „z drona" (E3 wieża, E6 wirnik)
- Doprecyzowanie: analiza SCADA „jeżeli udostępniono dostęp do danych"
- Wycięte z zakresu 5-letniego (przeniesione do ⚙ serwis producenta):
  - Pełna kontrola momentów dokręcenia (E2, E5, E6, E7)
  - Pomiar luzu łożyska wieńcowego (E5)
  - Diagnostyka wibracyjna łożyska głównego (E7)
  - Drony / dostęp linowy do łopat (E6)
- **Usunięto bloki „⚙ Czynności specjalistyczne (osobne zlecenie)"** — wszystkie wzory.
  Powód: mogły być źle odebrane przez klientów jako menu upsellingu. Dodatkowe zlecenia
  wynikają z zapisów w zaleceniach, nie z listy w opisie zakresu.
- Bloki „⚙ Wykonuje serwis producenta (art. 8b u.w.)" zostają.

### 3.3. Sekcja IV — pomiary elektryczne (5-letni)
Zastąpiono Tabele A/B/C strukturą Żeńsko (zgodną z `electrical-measurements.tsx`):
- **Podsumowanie pomiarów** — 8 wierszy (Nr protokołu / Data pomiaru / Data kolejnego /
  Orzeczenie / Ocena końcowa / Oględziny instalacji elektrycznej / Oględziny instalacji
  odgromowej i uziomów / Uwagi do oględzin i oceny)
- Nota: „Pełny protokół pomiarów stanowi załącznik do niniejszej kontroli (PDF)"
- **Identyfikacja użytych przyrządów** — tabela 3 kolumny (Model / Numer seryjny / Producent)
- **Osoby wykonujące pomiary** — tabela 3 kolumny (Imię i nazwisko / Numer uprawnień / Izba)
- Termowizja rozdzielnic → OPCJONALNIE (checkbox ☐) — nie obowiązkowa

Aplikacja generuje DOCX z identyczną strukturą via `/api/docx/[id]/route.ts:1987-2143`.

### 3.4. Sekcja V — informacje o serwisie
- **Usunięto:** „Zakres czynności serwisowych (zaznaczyć wykonane)" + tabela checkboxów
- Nota o serwisie z piktogramem ⚙ przeniesiona na koniec sekcji V (przed VI / VII PODPISY)
- Usunięte wzmianki „lub osobne zlecenie" / „lub na podstawie odrębnego zlecenia"
  ze wszystkich intro i legendy

### 3.5. Sekcja VI/IV — zalecenia (zmiana z 2026-05-11)
Rozszerzenie wzoru zaleceń (wzór Żeńsko):
- Tabela zaleceń **2 kolumny → 6 kolumn**: Lp. / Element / lokalizacja / Zakres robót
  remontowych / Rodzaj / Pilność / Termin wykonania
- Dodano tabelę **„Definicje rodzajów robót remontowych"** (K / NB / NG)
- Dodano tabelę **„Stopnie pilności"** (I natychmiast / II do 3 m / III do 12 m / IV do 5 lat)
- Dodano tabelę **„Kryteria oceny i klasyfikacji stanu technicznego"** — 5-stopniowa
  z procentami (dobry 0–15% / zadowalający 16–30% / średni 31–50% / zły 51–70% /
  awaryjny >71%) — **legenda klasyfikacyjna** uzupełniająca 4-stopniową PIIB
- Dodano 3 sekcje narracyjne (środowisko / dokumenty / metody i środki użytkowania)

### 3.6. Sekcja VII/VI — dokumentacja graficzna
- Zastąpiono linie kropek tabelą **2×6 (12 pustych komórek)** z ramkami
- Dodano podtytuł: „Dokumentacja fotograficzna wykonana podczas kontroli (elementy
  obiektu posiadające usterki lub wady, przewidziane do remontu)"

### 3.7. Wariant 5-letni odrębny (`_O`)
- Usunięta tabela UWAGA o objęciu pełnego zakresu rocznego
- Usunięta kolumna „ZAKRES KONTROLI ROCZNEJ (poszerzony)" z tabeli III
- Nagłówek pozostałej kolumny: „ZAKRES DODATKOWY 5-LETNI" → „ZAKRES 5-LETNI"
- Doprecyzowany akapit pod tabelą III („Kolumna „Zakres 5-letni" wskazuje czynności
  obowiązkowe co 5 lat (art. 62 ust. 1 pkt 2 PB)")

### 3.8. Style globalny
- Czcionka **Arial** w całym dokumencie (zamiast Calibri) — zgodnie z aplikacją
- Nowe tabele: granatowy header (`1B2230`) + biały bold tekst + ramki (`DDE3EA`)
  + zebra striping na wierszach body
- Stałe stylu zaczerpnięte z `src/lib/design/protocol-tokens.ts` (`HEX.graphite800`,
  `HEX.graphite200`)

## 4. Wariant uproszczony (`_U`) — filozofia
Inspekcja bez wjazdu na konstrukcję:
- Tylko poziom terenu + pierwszy segment wieży
- Główne narzędzia: lornetka, weryfikacja dokumentacji, analiza SCADA
- Brak piktogramów ⚙ w tabeli III — czynności wymagające wjazdu nie są listowane
- Nota wstępna wyjaśnia ograniczenia wariantu
- Pomiary elektryczne (5-letni) — pełne, bo te są na poziomie terenu / stacji rozdzielczej

## 5. Pomijane przy „styl Żeńsko" — wymaga decyzji

### Pytanie z końca sesji (do rozstrzygnięcia 2026-05-12)

Tabela III w moim szablonie ma strukturę:
```
| Header row                                      |
| ELEMENT NAME (merged 7 cols, blue separator)   |
| Data row (Pozycje / Zakres / Ocena / ...)      |
```

Żeńsko ma strukturę:
```
| Header row (granatowy)                          |
| ELEMENT name + dane w JEDNYM wierszu            |
```

**Opcje do wyboru jutro:**
- **A.** Pełen rebuild tabeli III jak Żeńsko (~2-3h pracy, duplikuje co robi aplikacja)
- **B.** Tylko styling visualny (granatowy header, ~15 min)
- **C.** Akceptujemy obecny stan — szablon do ręcznego wypełnienia ma inną filozofię niż
  generowany przez aplikację dokument. Aplikacja zawsze generuje w stylu Żeńsko.

Rekomendacja: **C lub B**.

### Inne pominięte
- Heurystyka „apply Żeńsko styling do wszystkich istniejących tabel" — wycofana, bo
  groziłaby zepsuciem specjalnych styli (np. „Kryteria oceny PIIB" z 4 kolorami per wiersz)
- Stylizacja istniejących tabel metryczki (Adres obiektu, Firma serwisowa) — bez zmian
  (zachowują oryginalny styl)

## 6. Pliki w zmianie (git status pending)

Nieskommitowane:
```
scripts/generate_piib_templates.py    — główny skrypt generujący (~1500 linii)
scripts/dump_docx.py                  — helper do dumpu .docx do .txt (do verify)
scripts/session_2026-05-11_wzory_PIIB.md  — ten plik
wzory_PIIB/                           — 4 protokoły + raport zmian (katalog untracked w git)
```

## 7. Otwarte z poprzednich sesji (nie ruszone)

Z porannej sesji 2026-05-10:
- ✅ FL693VE01BMD77 — turbina EW Ostrowite, klient Ventus (rozstrzygnięte, jeszcze nie wpisane
  do DB — TODO)
- ⏸ 12 AUTO-CREATED bez PDF na R2 — wciąż brakuje PDF-ów
- ⏸ T212/T214 — TODO
- ⏸ 2 pary z 2022 — TODO weryfikacja czy fragment buga czy legitne duplikaty
- ⏸ Import danych turbin z PDF (drugi z dwóch nowych tematów wieczornych — nie ruszony)

## 8. Plan na jutro (2026-05-12)

1. **Decyzja A/B/C** dla restrukturyzacji tabeli III (powyżej)
2. Weryfikacja wzorów po commitcie — open w Wordzie, sprawdź:
   - Sekcja VI/IV (Zalecenia) — nowe tabele wyglądają OK?
   - Sekcja VII (Dokumentacja) — siatka 12 pustych komórek OK?
   - Czcionka Arial wszędzie?
   - Sekcja V — usunięty „Zakres czynności serwisowych"?
3. Po akceptacji — `git commit` + `git push` + `gh pr create`
4. Wrócić do TODO listy (FL693VE01BMD77 do DB, 12 AUTO-CREATED, import turbin z PDF)

## 9. Skrót komend

```bash
# Regeneracja wszystkich 4 protokołów + raport zmian
python -X utf8 scripts/generate_piib_templates.py

# Dump zawartości .docx do tekstu (verify)
python scripts/dump_docx.py "path\to\file.docx" /tmp/output.txt

# Inspekcja konkretnej tabeli/komórki w pliku
python -X utf8 -c "from docx import Document; d=Document('plik.docx'); print(d.tables[8].cell(12,1).text)"
```

## 10. Rozstrzygnięcie decyzji A/B/C — 2026-05-11 evening

**Wybrany wariant: B** (styling wizualny). A odrzucony jako duplikowanie pracy aplikacji.

### Problem

W tabeli III wiersze rozdzielające elementy konstrukcyjne („1. FUNDAMENT I POSADOWIENIE",
„6. WIRNIK / ROTOR Z ŁOPATAMI" itd.) miały biały bold tekst na jasnoszarym tle zebry
`F5F7F9` — praktycznie nieczytelne (zobacz screenshot z sesji).

Diagnoza: wiersze są scalone przez całą szerokość tabeli (gridSpan = num_cols) i biały
tekst został zaautorowany w źródłowym docx, ale fill pozostał szary jako zwykła zebra
body row. `style_table_zensko` / `apply_zensko_style_to_existing_tables` nie były wołane
na tabeli III, więc nigdy nie nadały tym wierszom właściwego granatowego fill-u.

### Rozwiązanie

Dodano dedykowaną funkcję `fix_section_header_rows(doc)` w skrypcie:
- Iteruje wszystkie tabele w dokumencie (skip num_cols < 2).
- W każdej tabeli (poza row 0) wykrywa wiersze section-header heurystyką
  `gridSpan(first_cell) >= num_cols`.
- Nadaje granatowy fill `1B2230` (TABLE_HEADER_FILL) + utrwala biały bold tekst.

Wołana z każdej `generate_*` PO modyfikacjach treści, PRZED `apply_arial_font_globally`.

### Verify

```
Protokol_Kontroli_5-letniej_EW_PIIB.docx:   16 sekcji ok / 0 bad
Protokol_Kontroli_5-letniej_EW_PIIB_O.docx: 16 sekcji ok / 0 bad
Protokol_Kontroli_Rocznej_EW_PIIB_R.docx:   15 sekcji ok / 0 bad
Protokol_Kontroli_Rocznej_EW_PIIB_U.docx:   15 sekcji ok / 0 bad
```

### Raport zmian

Dodano sekcję 11 w `Raport_zmian_wzory_PIIB.docx` opisującą zmianę.

### Pułapka

Polski cudzysłów zamykający w stringu Python: ASCII `"` (U+0022) kończy string — musi być
Unicode `"` (U+201D). Złapane przy edycji body_paragraphs sekcji 11.
Memory note: `reference_polish_quotes_python.md`.
