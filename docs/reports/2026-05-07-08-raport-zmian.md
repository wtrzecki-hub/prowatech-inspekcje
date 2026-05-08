# Raport zmian — sesje 2026-05-07 i 2026-05-08

**Zakres:** dwie sesje rozwoju aplikacji **Prowatech Inspekcje**
- **2026-05-07** (poranna) — 10 PR-ów, 3 migracje bazy danych, ~1500 linii kodu
- **2026-05-08** (popołudniowa, dokończona dziś) — 10 PR-ów, 5 migracji, ~4500 linii kodu

**Łącznie:** 20 PR-ów zmergowanych do `main`, 8 migracji Supabase zaaplikowanych na produkcję, ~6000 linii kodu zmienionego/dodanego, wszystko wdrożone na `prowatech-inspekcje.vercel.app`.

**Punkt wyjścia obu sesji:** audyt wygenerowanych protokołów z inspekcji EW01 — FW Żeńsko (KSM Energia, kontrola 5-letnia 30.04.2026, protokół 001/P/2026, 15 zdjęć dokumentacyjnych, 11 zaleceń poprzednich + 10 zakresu robót).

---

## 1. Streszczenie wykonawcze

### Co dla inspektora wygląda inaczej w aplikacji

**Edycja inspekcji** — metryczka rozpisana na bazę danych klienta:
- "Strony protokołu" (Wykonawca / Przy udziale / Zarządca obiektu) wybiera się z listy zamiast wpisywać ręcznie tekstem. Inline dialog "Dodaj przedstawiciela" + auto-zaznacz dla bieżącej kontroli.
- Karta "Dane techniczne obiektu" w metryczce — edytowalne pola PIIB (rodzaj konstrukcji wieży, rok budowy, nr pozwolenia) zapisują się **bezpośrednio do karty turbiny** (bo to stałe parametry obiektu). Klikalny przycisk "Otwórz kartę turbiny".
- Klikalne kółka StatusBar — można cofnąć zatwierdzony protokół do szkicu (np. żeby dopisać brakujące pole), bez utraty dat podpisów.
- **3 nowe pola tekstowe w tabie "Wnioski"** — pkt 6 (ochrona środowiska), pkt 7 (weryfikacja dokumentów), pkt 8.6 (metody i środki dla turbin: zwykle "Nie dotyczy") z sensownymi placeholderami.

**Zalecenia z poprzednich kontroli** — sekcja II (Sprawdzenie wykonania) rozdzielona na 2 osobne tabele dla 5-letniej i rocznej, z auto-importem z najnowszej zakończonej inspekcji danego typu. Każda sekcja w nagłówku pokazuje **nr i datę protokołu źródłowego**. Numerki w kółeczku po lewej są edytowalne (manual override), po dodaniu/usunięciu wpisu numeracja zamyka dziurę automatycznie.

**Zakres robót remontowych (sekcja VI)** — tabela rozszerzona o 3 nowe kolumny zgodne z konwencją PIIB / WACETOB:
- **Element / lokalizacja** (np. "Fundament", "Wieża segment 2")
- **Rodzaj robót** — dropdown: K (konserwacja) / NB (naprawa bieżąca) / NG (naprawa główna)
- **Stopień pilności** — dropdown: I (natychmiast) / II (do 3 mies.) / III (do 12 mies.) / IV (do 5 lat)

Auto-renumeracja per-sekcja (3 niezależne liczniki: 5-letnie poprzednie / roczne poprzednie / zakres robót), edytowalny numer pozycji.

**Pomiary elektryczne (5-letnia)** — strukturalne pola "Oględziny instalacji elektrycznej" + "Oględziny instalacji odgromowej i uziomów" (wybór pozytywna/negatywna + opis przy negatywnej), poprzedzające ocenę końcową. Ocena końcowa zmieniona z textarea na Select (Pozytywna / Negatywna), uwagi widoczne tylko przy negatywnej. Sprzęt pomiarowy + osoby wykonujące pomiary — multi-select z bazy.

**Karta turbiny** rozszerzona o:
- **Sekcja "Dane techniczne"** — 11 nowych pól opisu konstrukcyjnego (liczba segmentów wieży, średnica/głębokość/klasa fundamentu, wysokość cokołu, materiały, dźwig serwisowy, kabel SN, stacja kontenerowa)
- **Urządzenia podlegające UDT** — sekcja 1:N (typ, producent, model, udźwig, częstotliwość przeglądów, daty + nr certyfikatu, podlega/nie podlega UDT, uwagi)
- **Sprzęt ewakuacyjno-ratunkowy** — analogiczna sekcja 1:N (PSA, drabiny z asekuracją, punkty zaczepienia)
- **Status weryfikacji per-wiersz UDT/Rescue** — selector 3-segmentowy: 🟡 Do weryfikacji / 🟢 Aktualne / 🔴 Nieaktualne. Wpisy "Nieaktualne" są pomijane w wygenerowanym protokole (sprzęt wycofany).

**Wygenerowany protokół PDF/DOCX** — kompleksowo zaktualizowany żeby spełniał wzorzec PIIB:
- Sekcja **Dokumentacja fotograficzna** — siatka 2 zdjęcia w wierszu z captionami (z `inspection_photos`)
- Sekcja **Wymagania podstawowe (art. 5 PB)** — 7 wymagań z pastelowymi kolorami komórek (🟢 spełnia / 🔴 nie spełnia / ⚪ nie dotyczy)
- Sekcja **Opis techniczny obiektu** — wszystkie wpisane pola turbiny + tabele UDT i sprzęt ratunkowy
- Sekcja **Pkt 6/7/8.6 ustaleń** — pełne teksty wpisane w tabie "Wnioski"
- **3 tabele-legendy** w sekcji VI (rodzaje robót, stopnie pilności, kryteria oceny stanu)
- Pierwsza kontrola roczna lub 5-letnia — automatyczna notka zamiast pustej tabeli ("brak poprzedniej kontroli, brak zaleceń do sprawdzenia")
- **Puste, niewypełnione pola pomijane** — protokół pokazuje tylko wypełnione dane, bez wierszy z myślnikiem

---

## 2. Nowe funkcje

### A. Metryczka inspekcji oparta na bazie klienta (sesja 2026-05-07, [PR #2](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/2))

Wcześniej free-text w trzech polach metryczki — teraz multi/single-select:

| Pole | Wcześniej | Teraz |
|---|---|---|
| Wykonawca kontroli | Free text `contractor_info` | Multi-select z `inspectors` (z `is_lead` + specjalność konstrukcyjna/elektryczna) |
| Przy udziale | Free text `additional_participants` | Multi-select z `client_representatives` (per klient) + inline dialog dodawania |
| Zarządca obiektu | Free text `manager_name` | Dropdown z `client_representatives` + inline dialog |

Walidacja UI (ostrzeżenie, nie blokada): minimum 2 inspektorów, dla 5-letniej wymagana konstrukcyjna + elektryczna.

**Dodatkowo:** karta "Dane techniczne obiektu" w metryczce z polami PIIB (rodzaj konstrukcji wieży, rok zakończenia budowy, nr i data pozwolenia na budowę). Edycja zapisuje **bezpośrednio do `turbines`** (debounce 800ms) — bo to stałe parametry obiektu, nie inspekcji. Klikalne kółka StatusBar pozwalają cofnąć podpisany protokół do szkicu z zachowaniem dat podpisów.

### B. Sprawdzenie wykonania zaleceń — 2 sekcje + nr protokołu źródłowego (2026-05-07 [PR #2](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/2) + 2026-05-08 [PR #13](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/13))

Sekcja II protokołu PIIB rozdzielona na 2 osobne tabele:
- **Ocena realizacji zaleceń z poprzedniej kontroli 5-letniej**
- **Ocena realizacji zaleceń z poprzedniej kontroli rocznej**

Każda z auto-importem (warstwy fallbacku):
1. Z najnowszej zakończonej inspekcji danego typu (`inspections.repair_scope_items` lub legacy `repair_recommendations`)
2. Z `historical_protocols` (PDF z archiwum — pokazuje header z datą + nr protokołu + linkiem)
3. Z `turbines.previous_findings` (legacy text)

Każda sekcja w nagłówku zawiera **"(nr X/T/YYYY, z dnia DD.MM.YYYY)"** — pobierane z metryczki inspekcji (`documents_reviewed.previous_5y/annual.info`, wpisuje inspektor).

**Trzy scenariusze workflow** obsłużone heurystycznie:
1. Turbina obsługiwana przez nas → archiwum + auto-import
2. Nowy obiekt (warunek udostępnienia protokołu) → inspektor wpisuje nr w metryczce
3. **Pierwsza kontrola** → automatyczna notka *"Pierwsza kontrola pięcioletnia / roczna — brak poprzedniej kontroli, brak zaleceń do sprawdzenia"*

### C. Strukturalne pomiary elektryczne (sesja 2026-05-07, [PR #2](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/2)+#3+#5+#6)

Sekcja "Pomiary" dla 5-letniej zyskała:
- **Sprzęt pomiarowy** — multi-select z bazy (uzupełnianej w admin), zapisywany do `inspection_measurement_equipment` junction
- **Osoby wykonujące pomiary** — multi-select inspektorów elektrycznych (zwykle inni niż konstrukcyjni)
- **2 strukturalne oględziny** — instalacja elektryczna + instalacja odgromowa/uziomów. Każda z wyborem `pozytywna`/`negatywna` + warunkowy opis. Auto-czyszczenie pola opisu przy zmianie z negatywnej na pozytywną.
- **Reorder UI**: oględziny → ocena końcowa (logiczna kolejność: oględziny są podstawą oceny)
- **Ocena końcowa**: textarea → Select (Pozytywna / Negatywna). Uwagi widoczne tylko przy ocenie negatywnej (UI cleanup po feedbacku Waldka — usunięto duplikację treści).

### D. Sekcja Zdjęć w PDF i DOCX (sesja 2026-05-07, [PR #8](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/8) + [#9](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/9) + [#11](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/11))

Wcześniej protokół pokazywał tylko placeholder text "Numerację fotografii zsynchronizowano z kolumną 'Nr fot.' w tabeli ustaleń". Teraz:
- Fetch `inspection_photos` z `file_url` (R2 storage), sortowane po `photo_number`
- Pre-fetch wszystkich obrazów równolegle (`Promise.all`)
- Siatka **2 zdjęcia w wierszu** z captionami "Zdjęcie nr X" italic poniżej
- Format 3:2 aspect (PDF: ~85mm szerokości, DOCX: 280×187 px)
- Graceful degradation: placeholder ramka gdy fetch nie pobrał (404, sieć)
- WEBP → JPEG fallback dla jsPDF

Dla EW01 to 15 zdjęć w protokole.

### E. Auto-renumeracja zaleceń + edytowalny numer (sesja 2026-05-07, [PR #7](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/7) + [#10](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/10))

Wcześniej `nextNumber = max + 1` globalnie i brak renumerow po delete — efekt: dziury (1, 2, 3, 5, 7, 8). Teraz:
- **3 niezależne liczniki 1..N** dla: 5-letnie poprzednie / roczne poprzednie / zakres robót remontowych
- Auto-renumber po `handleAdd`/`handleDelete`/auto-import
- Manual override przez kliknięcie numerka (debounce 600ms, save raw value, sortowanie po `item_number ASC` przed grupowaniem)
- Static kółko z numerem zamienione na `<input type=number>` styled jak kółko (spin buttons ukryte)

### F. Pkt 6/7/8.6 zakresu kontroli (sesja 2026-05-08, [PR #15](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/15))

Wzorzec PIIB wymaga aby protokół odzwierciedlał wszystkie zadeklarowane pkt zakresu kontroli. Wcześniej brakowało odniesienia do pkt 6 (ochrona środowiska), pkt 7 (weryfikacja dokumentów), pkt 8.6 ustaleń (metody i środki). Teraz:
- 3 nowe textarea w tabie **"Wnioski"** edytora inspekcji z sensownymi placeholderami:
  - "W trakcie kontroli dokonano przeglądu instalacji i urządzeń służących ochronie środowiska..."
  - "Zweryfikowano kompletność i aktualność dokumentów obiektu: KOB, protokoły serwisowe, certyfikaty UDT..."
  - "Nie dotyczy." (turbiny zwykle są konstrukcyjnie odporne na atmosferyczne wpływy)
- Renderery PDF/DOCX wyświetlają pełne teksty w sekcji III protokołu

### G. Zalecenia VI — kolumny urgency/work_kind/element (sesja 2026-05-08, [PR #16](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/16))

Tabela VI "Zakres robót remontowych" zgodna z konwencją branżową PIIB / WACETOB / Rozp. MSWiA z 16.08.1999 §3:
- `element_name TEXT` — element / lokalizacja
- `work_kind` enum: K (konserwacja) / NB (naprawa bieżąca) / NG (naprawa główna)
- `urgency_level` enum: I (natychmiast) / II (do 3 mies.) / III (do 12 mies.) / IV (do 5 lat)

Stopnie I=najpilniejszy zachowane zgodnie z konwencją Prowatech (mimo że PIIB ma odwrotną — dlatego **legenda obowiązkowa** w każdym protokole, dodana w PDF/DOCX). Auto-import z elementów inspekcji NIE wypełnia tych pól — inspektor wpisuje ręcznie po ekspertyzie.

### H. Karta turbiny rozszerzona (sesja 2026-05-08, [PR #17](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/17))

3 nowe obszary inspirowane archiwalnymi protokołami Prowatech:

**1. Opis techniczny — 8 nowych pól w `turbines`:**
- `tower_segments_count`, `nacelle_material`, `blade_material`, `foundation_diameter_m`, `foundation_depth_m`, `foundation_concrete_class`, `pedestal_height_m`, `service_crane_capacity_t`

(Po sesji 5 z tych pól usuniętych zgodnie z wytycznymi Waldka — patrz [PR #20](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/20).)

**2. Tabela `turbine_udt_devices` (1:N do turbines) — Urządzenia podlegające UDT:**
Typ urządzenia, producent, model, udźwig, status UDT (bool), częstotliwość przeglądów, daty + nr certyfikatu, uwagi inspektora. Dialog inline na karcie turbiny + soft-delete.

**3. Tabela `turbine_rescue_equipment` (1:N do turbines) — Sprzęt ewakuacyjno-ratunkowy:**
Typ (PSA, drabina z asekuracją, punkty zaczepienia), producent, model, cykl kontrolny, opis parametrów + uwagi.

RLS: admin/inspektor pełen dostęp, klient SELECT tylko swoich turbin (przez join `turbines` → `wind_farms` → `client_users`).

### I. Status weryfikacji per-wiersz UDT/Rescue (sesja 2026-05-08, [PR #21](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/21))

Dla każdego wpisu UDT i sprzęt ewakuacyjny dodano kolumnę `data_status` enum z workflow:
1. Pre-fill z archiwum → 'do_weryfikacji' (🟡)
2. Inspektor podczas kontroli → 'aktualne' (🟢) lub 'nieaktualne' (🔴)
3. UI: 3-segmentowy color-coded selector na każdym wpisie
4. PDF/DOCX automatycznie pomijają wpisy `nieaktualne` (sprzęt wymieniony nie trafia do nowego protokołu)

Default `aktualne` — dla ręcznych wpisów inspektor sam wpisuje co właśnie sprawdził, więc dane są aktualne z definicji. Pre-fill z archiwum nadpisuje na `do_weryfikacji` explicite.

---

## 3. Poprawki błędów (bug fixy)

### Sesja 2026-05-08

| Bug | Opis | PR |
|---|---|---|
| **"Lp" / "Rodzaj" / "Pilność" łamane** | Nagłówki tabeli VI (Zalecenia) łamane na 2 linie z powodu zbyt wąskich kolumn | [#13](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/13) (fix A) |
| **Tytuł "Metody i środki..." obcięty** | Długi subheading bez wrappingu, kończył się na "i" zamiast "innych czynników" | [#13](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/13) (fix B — globalny `splitTextToSize` w `addSubHeading`) |
| **"Lp" w tabeli II łamane** | Sekcja Sprawdzenie wykonania, podobnie do tabeli VI | [#13](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/13) (fix C) |
| **Pierwsza kontrola — pusta tabela** | Dla turbiny bez poprzedniej kontroli sekcja II pokazywała 4 puste rzędy z "—" | [#13](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/13) (fix E + F) |
| **Puste pola turbiny w PDF** | Niewypełnione pola pokazywały wiersze z myślnikiem ("—") zamiast być pomijane | [#19](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/19) (`addKeyValueTable` filter pustych globalnie) |
| **Niespójność "Dane kontroli" + banner przeterminowany** | Sekcja na dole karty turbiny + banner "Przegląd przeterminowany" + hero spec używały rozjechanych denormalized fields w `turbines` (UUID zamiast nr protokołu, data 4.05.2026 zamiast 30.04.2026, błędny status "przeterminowany"). Sekcja "Najbliższe przeglądy" obok pokazywała poprawne dane. | [#20](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/20) (fix przez computed values z najnowszej `inspections`) |
| **Service include domyślnie ON** | Checkbox "Uwzględnij sekcję Serwis w protokole" startował zaznaczony — sekcja V renderowała się z pustymi polami nawet gdy inspektor nie miał danych od operatora | [#14](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/14) (default `false`) |

### Sesja 2026-05-07

| Bug | Opis | PR |
|---|---|---|
| **Toggle "Pomiary" niewidoczny** | Po dodaniu protokołu do archiwum trzeba było odświeżyć stronę żeby zobaczyć przełącznik | #4 (`377fa4e`) |
| **Auto-fill metryczki dokumentów** | Pole "Protokół z poprzedniej kontroli rocznej/pięcioletniej" nie zaciągało się z archiwum | `0a40bde` |

---

## 4. Zmiany techniczne

### Migracje Supabase (8 łącznie, wszystkie zaaplikowane na prod `lhxhsprqoecepojrxepf`)

**Sesja 2026-05-07:**
1. `2026-05-07_client_representatives_and_participants.sql` — nowa tabela `client_representatives` (per klient, RLS) + junction `inspection_participants`
2. `2026-05-07_previous_recs_source_type.sql` — kolumna `source_inspection_type` TEXT (annual/five_year/null) + indeks w `previous_recommendations`
3. `2026-05-07_visual_inspection_results.sql` — 4 kolumny TEXT z CHECK constraint w `inspections` (pomiary elektryczne + odgromowe)

**Sesja 2026-05-08:**
4. `2026-05-08_service_include_default_false.sql` — zmiana DEFAULT na FALSE
5. `2026-05-08_inspection_scope_findings.sql` — 3 pola TEXT (env_protection, doc_verif, weather)
6. `2026-05-08_repair_scope_urgency_kind.sql` — 3 kolumny w `repair_scope_items` (element_name + work_kind + urgency_level z CHECK)
7. `2026-05-08_turbine_technical_description_udt_rescue.sql` — 8 pól w `turbines` + 2 nowe tabele 1:N (UDT + Rescue) + RLS
8. `2026-05-08_udt_rescue_data_status.sql` — kolumna `data_status` enum w obu nowych tabelach

### Nowe komponenty React

- `src/components/turbine/udt-rescue-sections.tsx` (~520 linii) — `UdtDevicesSection` + `RescueEquipmentSection` + `DataStatusSelector`

### Refaktoring rendererów PDF/DOCX

- `src/app/api/pdf/[id]/route.ts` — łącznie ~1100 nowych linii (4 nowe sekcje + 6 fix-ów + filter pustych pól + filter `data_status='nieaktualne'`)
- `src/app/api/docx/[id]/route.ts` — analogicznie ~1500 nowych linii
- Globalne usprawnienia: `addSubHeading` zawija długie tytuły, `addKeyValueTable` pomija puste wiersze

### Workflow `gh` CLI z worktree

Kontynuacja patternu z sesji 2026-05-07 (10 PR-ów) i 2026-05-08 (10 PR-ów). Każdy PR:
1. `git checkout -b claude/{name} origin/main` z worktree
2. selektywne `git add` + commit z HEREDOC
3. `git push` + `gh pr create --base main`
4. `gh api -X PUT repos/.../pulls/{N}/merge -f merge_method=squash` (workaround dla `gh pr merge` które fail-uje w worktree)
5. `gh api -X DELETE repos/.../git/refs/heads/{branch}` (cleanup)

Vercel auto-deploy z `main` po każdym merge — zwykle ~1-2 min build + deploy.

---

## 5. Statystyki sumaryczne

| Metryka | 2026-05-07 | 2026-05-08 | Suma |
|---|---|---|---|
| PR-y zmergowane | 10 | 10 | **20** |
| Migracje SQL | 3 | 5 | **8** |
| Linie kodu zmienione | ~1500 | ~4500 | **~6000** |
| Nowe pola w bazie | 4 | 17 | **21** |
| Nowe tabele | 2 | 2 | **4** |
| Nowe komponenty React | — | 1 | **1** |

**Liczba PR-ów rozdzielona po typie:**
- Nowe funkcje: 12 PR-ów
- Bug fixy / fix-y wizualne: 4 PR-y
- Cleanup / dorzutki: 2 PR-y
- Dokumentacja sesji: 2 PR-y

**Pliki najmocniej zmodyfikowane:**
- `src/app/api/pdf/[id]/route.ts` — ~1100 nowych linii
- `src/app/api/docx/[id]/route.ts` — ~1500 nowych linii
- `src/components/inspection/inspection-metadata-piib.tsx` — ~900 nowych linii (z 2026-05-07)
- `src/components/inspection/electrical-measurements.tsx` — strukturalne oględziny + Select ocena
- `src/components/inspection/previous-recommendations-table.tsx` — 2 sekcje + renumber
- `src/components/inspection/repair-scope-table.tsx` — kolumny urgency/work_kind/element + renumber
- `src/components/inspection/status-bar.tsx` — klikalne kółka (cofanie do szkicu)
- `src/components/forms/turbine-form.tsx` — 11 nowych pól (potem 6 zostało)
- `src/app/(protected)/turbiny/[id]/page.tsx` — 2 nowe sekcje (UDT/Rescue) + bug fix Dane kontroli
- `src/app/(protected)/inspekcje/[id]/page.tsx` — 3 textarea pkt 6/7/8.6
- `src/lib/design/protocol-tokens.ts` — `ART5_MET_COLORS` (pastele art. 5 PB)

---

## 6. Stan końcowy danych w bazie po obu sesjach

**EW01 — FW Żeńsko (turbina referencyjna używana do testów):**
- 5 strukturalnych pól opisu technicznego wpisanych z PDF 5-letnia 2022 (POC pre-fill, sesja 2026-05-08)
- 3 wpisy UDT (Podest GLOBALLift R4 DE, 2 Wciągarki Harrington), wszystkie z `data_status='do_weryfikacji'`
- 3 wpisy Rescue (PSA AG 10K, Drabina z asekuracją, Punkty zaczepienia), wszystkie z `data_status='do_weryfikacji'`
- 15 zdjęć dokumentacyjnych w `inspection_photos` (z R2 storage)
- 8 zaleceń `previous_recommendations` z source_inspection_type='five_year', 3 z 'annual'
- 10 wpisów `repair_scope_items` (zakres robót, częściowo z auto-importu, częściowo manualnie)

**Skala bazy:**
- 425 turbin w bazie
- 118 turbin ma archiwum protokołu 5-letniego (PDF z R2)
- 1 turbina (EW01) ma wpisany strukturalny tech_data — pozostałe 117 czeka na full feature pre-fill

---

## 7. Open items / plany na następną sesję

### Priorytet 1 — Pre-fill 117 turbin z archiwalnych protokołów PDF (full feature)

POC dla EW01 potwierdził strategię: 1 PDF (12 MB) → `pdftotext -layout` → 11 strukturalnych wpisów w 5 minut. Dla 117 turbin:

**Plan implementacji:**
- `POST /api/turbines/[id]/extract-from-archive` — pobiera PDF z R2, parsuje pdf→text, wysyła do **Anthropic Claude Sonnet 4.6** (z prompt caching + tool use), zwraca JSON `{turbine_fields, udt_devices[], rescue_equipment[]}`
- Dialog UI w karcie turbiny: dropdown z protokołami archiwalnymi → "Wyodrębnij" → preview z diff vs current → inspektor zatwierdza/edytuje
- Strona admin "Pre-fill batch" — checkboxy 117 turbin, równolegle 5-10 wywołań, raport z błędami
- Pre-fill ustawia `data_status='do_weryfikacji'` na wszystkich wpisach UDT/Rescue
- Pomijamy `notes` (uwagi inspektora — niech wpisuje świeżo przy najbliższej kontroli)

**Skala:** ~600-1000 linii kodu, 1-2 dni pracy, koszt API ~$2-5 za batch 117 turbin (Sonnet 4.6 + prompt caching).

### Priorytet 2 — Auto-fill `documents_reviewed` z `historical_protocols`

Aktualnie inspektor wpisuje ręcznie nr+datę poprzedniego protokołu w metryczce nawet gdy w archiwum są dane. Można dodać auto-fill przy pierwszym otwarciu metryczki — preferuj najnowszy protokół danego typu z `historical_protocols`. Inspektor może nadpisać.

### Priorytet 3 — Klonowanie UDT/Rescue do snapshot inspekcji (live vs frozen)

Aktualnie sekcja UDT/Rescue w PDF/DOCX bierze aktualne wartości z `turbine_udt_devices` — co znaczy że stary, signed protokół po edycji UDT pokaże nowe dane przy kolejnym renderze. Pattern PIIB z 2026-05-07 (snapshot pól PIIB do dedykowanej tabeli per inspekcja) można rozszerzyć na UDT/Rescue.

### Mniejsze open items

- Bug UX dialogów `Dodaj urządzenie UDT` / `Dodaj sprzęt ewakuacyjny`: button INSERTuje pusty wiersz do bazy zanim user wpisze pola. Klik `Usuń` resztkę usuwa, ale jeśli user przeładuje stronę bez zapisu — phantom row zostaje.
- Trigger AFTER INSERT/UPDATE na `inspections` do sync `turbines.last_*/next_inspection_date` (denormalized fields nie są już używane przez UI, ale legacy code może; alternatywnie — DROP COLUMN).
- Duplikaty wierszy `service_info` per inspection (istniejący bug danych — EW01 draft 73f54344 ma 2 wiersze, signed 3eaf4810 ma 8 z mieszanymi `include_in_protocol`).
- Sekcja "Inne zalecenia (bez przypisanego źródła)" — `previous_recommendations` z `source_inspection_type=NULL` (legacy ~10 wpisów). Pattern UX: hurtowe migracje + przyciski "Migruj wszystko do 5-letniej" / "Migruj wszystko do rocznej" / "Usuń wszystkie".
- WindFarmForm (`/farmy/[id]`) nie ma input dla `area_label` (pole z 2026-04-28). Można dorzucić select "Wschód/Zachód/Południe/Inny/[brak]".

---

## 8. Lekcje i obserwacje

### Workflow

1. **Multiple uwag w jednym pliku → bundle do jednego PR** — gdy zmiany dotyczą tych samych plików (renderery), próba rozdzielenia per-uwaga generuje konflikty 1:1 line. Lepiej zbundlować i merge'ować pierwsze. Sprawdzone w sesji 2026-05-08: PR #13 zawierał wszystkie zmiany rendererów (1206 insertions) + 6 fix-ów wizualnych, PR #14-#17 to czyste UI+migracje bez ani jednego konfliktu.
2. **POC manualny przed full feature** — przed zbudowaniem AI extraction dla 117 turbin (~600-1000 linii kodu) zrobiliśmy 5-min POC manualny dla 1 turbiny (`pdftotext` + grep + SQL). Potwierdziło że strategia działa, dane są dostępne, koszt full feature jest uzasadniony.
3. **Iteracyjny review wygenerowanego PDF** — 5 generacji v1→v5 w trakcie sesji 2026-05-08, każda z konkretnym screenshotem od Waldka i inkrementalnym fix-em. Szybsze niż próba przewidzenia wszystkich problemów z góry.

### Architektura

4. **Heurystyka zamiast nowej flagi w schemacie** — detekcja "pierwszej kontroli" przez `!sourceInfo && rows.length === 0` jest wystarczająca dla 3 scenariuszy workflow Waldka (kontynuacja / nowy obiekt / pierwsza). Nie wymaga nowego pola w bazie.
5. **`data_status` per-wiersz vs flaga global** — workflow `do_weryfikacji → aktualne / nieaktualne` per-row dla UDT/Rescue jest praktyczny: pokazuje wizualny sygnał (badge), filter w PDF pomija wycofany sprzęt automatycznie. Default `'aktualne'` dla ręcznych wpisów (inspektor wpisuje co właśnie sprawdził) + nadpisanie na `'do_weryfikacji'` w pre-fill.
6. **Denormalized fields niesynchronizowane** — `turbines.last_inspection_date/protocol/next_inspection_date` rozjeżdżają się z aktualnym stanem `inspections`. Lepiej liczyć computed values z najnowszej zakończonej inspekcji niż polegać na cached pole.

### Techniczne

7. **Supabase Auth redirect na lokal** — `Additional Redirect URLs` musi zawierać explicite `http://localhost:3000/auth/callback` (bez `**` wildcard). Bez tego OAuth z localhost zawraca na produkcję.
8. **PDF iteracje testowe** — `start "" "<plik>.pdf"` w Bash uruchamia default viewer, ale po otwarciu plik jest locked. Można skopiować z `Downloads` do worktree dla `pdftotext -layout` extraction (Git Bash MinGW ma `pdftotext.exe`), bez ruszania oryginału.
9. **`gh pr merge` w worktree fail** — kontynuacja workaround `gh api -X PUT repos/.../pulls/{N}/merge -f merge_method=squash`. Działa stabilnie.

---

_Raport przygotowany 2026-05-08 na zakończenie sesji popołudniowej. Pełne zapisy obu sesji w [docs/sessions/2026-05.md](../sessions/2026-05.md)._
