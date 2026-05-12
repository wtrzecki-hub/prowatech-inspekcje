# Propozycje sesji — Prowatech Inspekcje

_Lista tematów do wyboru przy nowej sesji. Otwórz nowy chat z Claude'em i wskaż numer tematu (np. „Robimy temat 1") albo skopiuj cały blok jako brief._

_Po wykonaniu tematu — zaznacz `[x]`, ewentualnie dopisz numer PR-a w sekcji „Status". Dodawaj nowe tematy poniżej, najstarsze niezamknięte na górze._

---

## 1. Instalator `.exe` — skróty na pulpit dla klientów i współpracowników

**Status:** nie rozpoczęte (rozmowa z 2026-05-12, odłożona na rzecz cleanupu repo i zaleceń).

**Cel:** Klienci i inspektorzy klikają jeden `.exe`, dostają skrót na pulpicie z logo ProWaTech, który otwiera odpowiedni URL w przeglądarce.

**Zakres:**
- **2 osobne `.exe`** (jeden dla klientów, jeden dla współpracowników)
- **Klienci** → otwiera `https://prowatech-inspekcje.vercel.app/portal/login` *(lub docelowo `https://portal.prowatech.pl` po wykonaniu tematu 2)*
- **Współpracownicy** → otwiera `https://prowatech-inspekcje.vercel.app/dashboard` *(lub `https://app.prowatech.pl`)*
- Kreator w języku polskim, ikona z `public/logo-prowatech.png` (konwersja PNG → ICO przez Python Pillow)
- Skrót na pulpicie, opcjonalnie w menu Start
- Brak instalacji aplikacji na dysku — to tylko skrót

**Plan techniczny:**
- Stack: **Inno Setup 6** (darmowy, standard dla Windows installerów)
- W repo: `installers/client-shortcut.iss` + `installers/inspector-shortcut.iss` + `installers/prowatech.ico` + skrypt `scripts/generate_ico.py`
- Build: `ISCC.exe installers/client-shortcut.iss` → wypluwa `Output/SetupKlient.exe`

**Co Waldek musi zrobić jednorazowo:**
- Pobrać Inno Setup 6 z [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php) (≈3 MB) lub `winget install JRSoftware.InnoSetup`

**Decyzje do podjęcia w sesji:**
- Czy adres docelowy to `vercel.app` (od razu działa) czy `prowatech.pl` (czekać na temat 2)?
- Skrót w menu Start: tak / nie?

---

## 2. Instrukcja dla administratora domeny — podpięcie `prowatech-inspekcje` pod własną domenę

**Status:** nie rozpoczęte.

**Cel:** Wytworzyć dokument PDF/MD do wysłania administratorowi domeny `prowatech.pl`, który krok po kroku pozwoli mu podpiąć aplikację pod własną subdomenę (np. `portal.prowatech.pl` dla klientów, `app.prowatech.pl` dla inspektorów).

**Stan obecny:**
- Aplikacja działa na `prowatech-inspekcje.vercel.app`
- R2 pliki pod `pub-edbf124678454e819a88cd7054401694.r2.dev`
- Memory `project_design_decisions.md` i `prowatech-redesign.md:206` wspominają `portal.prowatech.pl` / `app.prowatech.pl` jako propozycję

**Zakres dokumentu:**
- Sekcja A — **DNS:** rekordy CNAME (np. `portal CNAME cname.vercel-dns.com`), TTL, weryfikacja przez `nslookup`
- Sekcja B — **Vercel Project Settings → Domains:** dodanie domeny, weryfikacja przez DNS, automatyczny SSL Let's Encrypt
- Sekcja C — **Supabase Auth → URL Configuration:** zaktualizować `Site URL` + dodać do `Redirect URLs` nowe ścieżki (`/auth/callback`, `/portal/auth/reset`)
- Sekcja D — **R2 Custom Domain** (opcjonalnie): `files.prowatech.pl` jako CNAME do Public Development URL, zmiana `R2_PUBLIC_URL` w env Vercela
- Sekcja E — **Test plan:** OAuth z nową domeny, reset hasła, generowanie PDF z linkami do zdjęć

**Decyzje do podjęcia w sesji:**
- Jedna domena dla obu rolei (`app.prowatech.pl`, prefiks `/portal` dla klientów) czy dwie subdomeny?
- Czy R2 custom domain włączamy od razu (wymaga osobnego CNAME), czy zostawiamy `r2.dev` na razie?
- Format dokumentu: MD (do przeczytania w GitHub) czy PDF (do wysłania mailem)?

---

## 3. Sekcja III. USTALENIA — bugi z audytu Artura (2026-05-12)

**Status:** ✅ wykonane 2026-05-12 (zob. sesje wykonane). Źródło: `uwagi_Prowatech_12_05_2026.docx` (Artur).

**Bug 1 — numeracja nie po kolei** → PR [#35](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/35).
- Przyczyna: fetch `inspection_elements` szedł z `.order('element_definition_id')` — UUID, więc kolejność pseudolosowa
- Fix: client-side sort po `element_number` po fetchu (dwa miejsca w `(protected)/inspekcje/[id]/page.tsx`)

**„Brak połączeń wieża/fundament"** — to NIE bug, tylko świadoma decyzja merytoryczna z migracji `annual_scope_consolidation_2026_05_05`:
- Elementy 2 (Flansze), 5 (Wieża–gondola), 7 (Gondola–wirnik) wyłączone z rocznej (PB art. 62 ust. 1)
- Ich scope scalony do `scope_annual` Elementu 3 (Wieża) i 4 (Gondola) — inspektor ma te połączenia do oceny tam
- Luki w numeracji rocznej (brak 2, 5, 7, 12, 16) są zgodne z PB i celowe

**Bug 2 — pole Element + zdjęcia w „Wnioski"** → rozwiązany w PR #32 (`element_name` w prev_rec i scope, `ScopeItemPhotos` per pozycja zakresu robót, render zdjęć w sekcji VI generatora).

---

## 4. Metryczka — bug „Wykonawca kontroli nie zaznacza się"

**Status:** nie rozpoczęte. Źródło: audyt Artura.

**Cel:** Naprawić zapisywanie/wczytywanie multi-selectu inspektorów w metryczce.

**Symptom:** „Nie zaznacza się Wykonawca kontroli pomimo wybrania kontrolerów w momencie wypełniania pierwotnie"

**Lokalizacja:** `src/components/inspection/inspection-metadata-piib.tsx` (PR #2 z 2026-05-07 — multi-select inspektorów + junction `inspection_inspectors`).

**Hipoteza:** UI po reload nie ładuje aktualnego stanu z `inspection_inspectors` lub nie zapisuje zmian (debounce 800ms broken / inny bug).

**Plan:**
- Reprodukcja na EW Kamlarki / EW01
- SQL check `inspection_inspectors` — czy są wpisy
- Debug UI flow loadInspectors + handleToggleInspector

---

## 5. Metryczka — duplikacja słowa „Okazano"

**Status:** ✅ wykonane 2026-05-12 → PR [#36](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/36). Źródło: audyt Artura + screenshot.

**Bug:** w sekcji „Dokumenty przedstawione do wglądu" słowo „Okazano" pojawiało się dwa razy — w Selecie statusu (lewa kolumna) ORAZ jako prefix w polu „Numer protokołu / data / uwagi" (prawa kolumna, np. „Okazano, nr 59/T/2025, z dnia 05.05.2025").

**Przyczyna:** `loadDocumentsAutoFill` budował `info` jako pełny string z prefixem „Okazano, " i ustawiał `status` na null. Inspektor potem ręcznie ustawiał status w Selecie → duplikacja.

**Fix:**
- `loadDocumentsAutoFill` zwraca teraz `DocumentEntry` z `status='okazano'` + `info` bez prefiksu
- Call site auto-fill zachowuje świadomy wybór statusu inspektora (`existing.status ?? proposed.status`)
- Migracja `2026-05-12_strip_okazano_prefix_from_docs.sql` — backfill 6 istniejących inspekcji w bazie (już zaaplikowany)

---

## 6. Generator DOCX — błędni wykonawcy „Andrzej i Tomek"

**Status:** ✅ wykonane 2026-05-12 → PR [#34](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/34). Źródło: audyt Artura.

**Cel:** Naprawić logikę wyboru wykonawcy kontroli w `src/app/api/docx/[id]/route.ts`.

**Symptom:** „W wygenerowanym docx błędnie wykonawca kontroli wstawia Andrzeja i Tomka"

**Hipoteza:** Hardcoded fallback (legacy z bardzo wczesnych wersji) lub niepoprawne join na `inspection_inspectors` → `inspectors`.

**Plan:**
- Grep `Andrzej`, `Tomek` w `src/app/api/docx/[id]/route.ts` — czy hardcoded
- Jeśli tak: usunąć, użyć `inspection_inspectors` z join na `inspectors`
- Jeśli nie: zbadać czemu join wybiera tych inspektorów

---

## 7. Generator DOCX — pusta sekcja „Załączniki" rendererowana z 6 placeholder-punktami

**Status:** ✅ wykonane 2026-05-12 → PR [#34](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/34) (bundle z tematem 6). Źródło: audyt Artura.

**Cel:** Pomijać pustą sekcję „Załączniki do protokołu" lub renderować jednym wierszem „Brak załączników".

**Symptom:** „Załączniki do protokołu — generuje aż 6 punktów pomimo żadnego załącznika"

**Plan:**
- Lokalizacja: `src/app/api/docx/[id]/route.ts` (sekcja Załączniki, hardcoded placeholdery)
- Analog: PR #19 (filter pustych pól w PDF/DOCX) — globalna polityka „lepiej puste niż placeholder"
- Decyzja: skip sekcji vs render „Brak załączników" (preferuję skip — zgodnie z PR #19)

---

## 8. Generator DOCX/PDF — sekcja III. USTALENIA nie zawiera zaleceń z poprzedniego roku ani opisów elementów

**Status:** ⏸️ wymaga dopytania Artura (sesja 2026-05-12 — diagnostyka bez dostępu do bazy niemożliwa).

**Cel:** Naprawić render sekcji III w generatorach.

**Symptom Artura:** „W Elementy → w 3. Wieża wpisałem Opis i ustalenia z kontroli, dodałem zdjęcie i nr fotografii 1 (bez wpisywania w sekcji Zalecenia/uwagi) — w wygenerowanym dokumencie nie jest to ujęte w tabeli. Dodatkowo nie są zaimplementowane zalecenia z poprzedniego roku w tabeli."

**Lokalizacja:** generatory PDF + DOCX — sekcja III. USTALENIA.

**Co zostało zbadane (2026-05-12):**
- Fetch `inspection_elements` w obu generatorach zaciąga `notes`, `recommendations`, `photo_numbers` — czyli pola są pobierane
- Render w tabeli III renderuje wszystkie elementy poza tymi z `is_not_applicable=true` LUB bez `element_definition`
- `notes` (pole „Opis i ustalenia z kontroli") jest renderowane w kolumnie „OPIS I USTALENIA Z KONTROLI" w tabeli rocznej (linia ~1938 docx, podobnie pdf)

**Hipotezy bug 1 (opis nie widoczny):**
- a) Element 3. Wieża miał `is_not_applicable=true` (case-bug: jeśli user wpisał coś w opis, sekcja go pomija)
- b) Autosave UI nie zapisał `notes` do bazy
- c) Artur patrzył w sekcję III tabeli, ale opis pojawił się w kolumnie OPIS, nie ZALECENIA — myli kolumny

**Czego potrzebujemy od Artura żeby ruszyć:**
- ID inspekcji którą testował (link do karty `/inspekcje/{id}`) ALBO screenshot wygenerowanego DOCX-a + screenshot z karty elementu 3. Wieża
- Verbalna potwierdzenie czy element jest oznaczony „Nie dotyczy" w UI

**Bug 2 (prev_recs w sekcji III):** to nie bug, to feature wymagający decyzji — sekcja II już zawiera prev_recs, czy Artur chce żeby pojawiały się też w sekcji III, i jako co (kolumna `ZALECENIA`? osobny wiersz?). Wymaga uzgodnienia układu z Arturem.

---

## 9. Pytanie/decyzja — widoczność „Następna kontrola 5-letnia" i „Następna kontrola elektryczna"

**Status:** decyzja Waldka, nie task techniczny. Źródło: audyt Artura.

**Pytanie Artura:** „Czy pole «Następna kontrola 5-letnia» i «następna kontrola instalacji elektrycznej» powinny być widoczne?"

**Kontekst:** Karta turbiny `(protected)/turbiny/[id]/page.tsx` ma sekcję „Najbliższe przeglądy" (PR #20 — bug Dane kontroli + computed values z `inspectionsHistory`).

**Decyzja:** widoczne / ukryte / widoczne tylko dla admin? Bez kodowania — najpierw konsultacja.

---

## 10. DOCX — niejasne uwagi Artura („chyba lepiej, żeby było odwrotnie")

**Status:** wymaga dopytania Artura.

**Symptom:** W DOCX-u Artura jest fraza „Chyba lepiej, żeby było odwrotnie" — bez kontekstu (pewnie screenshot się nie załączył w docx).

**Plan:** dopytać Artura o screenshot lub bardziej konkretne wyjaśnienie czego dotyczy.

---

## Sesje wykonane

_Najnowsze na górze. Format: `[x] N. Tytuł — data — PR(y)`._

- [x] **5. Duplikacja słowa „Okazano" w metryczce (auto-fill prefix + Select)** — **2026-05-12** — [#36](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/36)
- [x] **3. Numeracja sekcji III nie po kolei — sortowanie po element_number** — **2026-05-12** — [#35](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/35) (bug 2 z T3 był pokryty już PR #32)
- [x] **6 + 7. Wykonawca kontroli z multi-selectu (zamiast legacy "Andrzej i Tomek") + pomiń puste załączniki w DOCX/PDF + miejsce na pieczątkę/podpis + rozdzielenie sygnariusz/branżowy** — **2026-05-12** — [#34](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/34)
- [x] **Auto-fill deadline z urgency (kontynuacja #32) — runImport + backfill on-load + TZ off-by-day fix** — **2026-05-12** — [#33](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/33)
- [x] **Element/lokalizacja w prev_rec + auto-fill deadline z urgency + zdjęcia w sekcji VI** — **2026-05-12** — [#32](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/32) (pokrywa pkty 1+2+3 audytu Artura)
- [x] Cleanup root + Etap 0/1/2/3 sekcji Zalecenia (audyt EW Kamlarki) — **2026-05-12** — [#28](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/28), [#29](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/29), [#31](https://github.com/wtrzecki-hub/prowatech-inspekcje/pull/31)
