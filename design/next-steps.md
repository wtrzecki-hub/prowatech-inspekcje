# ProWaTech Inspekcje — kolejność dalszych prac

_Dokument roboczy. Data: 2026-04-23._

---

## 1. Faza 3 — Portal klienta (w toku)

**Co:** Osobny portal (`/portal/*`) dla operatorów farm wiatrowych z logowaniem
email + hasło tymczasowe, wymuszeniem zmiany hasła przy pierwszym logowaniu,
resetem hasła przez email, widokami read-only inspekcji/zaleceń/protokołów.

**Dlaczego teraz:** Największa luka funkcjonalna zgłoszona przez klienta — operatorzy
farm dostają protokoły e-mailem, bez żadnego panelu. Portal zamyka tę lukę i
podnosi wartość produktu dla wszystkich ~20 istniejących klientów.

**Status:** Implementacja w toku (Bloki 1–5).

**Pozostałe kroki do zamknięcia Fazy 3:**
- Konfiguracja `SUPABASE_SERVICE_ROLE_KEY` na Vercelu (admin)
- Dodanie `/portal/auth/reset` do "Additional Redirect URLs" w Supabase Auth
- Weryfikacja na Vercelu z testowym kontem klienta

---

## 2. Faza 4 — Design critique prototypu (po Fazie 3)

**Co:** Przegląd `design/prowatech-prototype.html` pod kątem niezaimplementowanych
elementów UX z propozycji designu (sparklines na dashboardzie, gęstsza tabela
inspekcji z filtrami jako chips, left-bar w aktywnym nav item sidebaru,
sticky progress bar w formularzu inspekcji).

**Dlaczego po Fazie 3:** Portal klienta jest priorytetem biznesowym — zmiany UX
panelu inspektora mogą poczekać i nie blokują klientów.

**Narzędzie:** `/design:design-critique` na pliku prototypu.

---

## 3. Accessibility review — przed oddaniem klientowi

**Co:** Przegląd WCAG 2.1 AA działającej aplikacji: kontrast par tekst/tło
(szczególnie warning-amber i graphite-500 na białym), focus rings klawiaturowe,
kolejność Tab w formularzu inspekcji, ARIA labels na pickerach i dialogach
Radix/shadcn.

**Dlaczego na końcu:** Wymaga działającej, skończonej aplikacji (nie można testować
a11y na prototypie HTML). Radix UI pokrywa ~90% wymagań automatycznie — review
powinien być stosunkowo szybki (szacunek: 1 dzień).

**Narzędzie:** `/design:accessibility-review` na działającej appce (Vercel preview).
