/**
 * Helpery formatowania pól metryczki protokołu (PDF/DOCX).
 */

interface ClientForOwner {
  name?: string | null
  address?: string | null
  nip?: string | null
}

/**
 * Buduje wartość pola "Właściciel obiektu" w protokole. Dokleja adres
 * siedziby i NIP z karty klienta, gdy `owner_name` puste lub matchuje
 * `client.name` (user nie nadpisał świadomie).
 *
 * Uwaga Waldka 2026-05-12: w protokole musi być pełna identyfikacja
 * właściciela (nazwa + adres + NIP), żeby można było wysłać do urzędu.
 *
 * Przykład:
 *   `Solbet Sp. z o.o., ul. Toruńska 71, 86-050 Solec Kujawski, NIP: 5540231993`
 *
 * Jeśli inspektor wpisał ręcznie inny tekst w `owner_name` (np. dla
 * inspekcji gdzie właściciel ≠ klient z farmy), respektujemy jego wpis
 * bez doklejania danych z `clients`.
 */
export function buildOwnerLine(
  ownerName: string | null | undefined,
  client: ClientForOwner | null | undefined,
): string {
  const trimmedOwner = (ownerName || '').trim()
  const clientName = (client?.name || '').trim()

  // Inspektor wpisał inny tekst niż klient → respektujemy wpis bez zmian.
  if (trimmedOwner && clientName && trimmedOwner !== clientName) {
    return trimmedOwner
  }

  const name = trimmedOwner || clientName
  if (!name) return ''

  const parts: string[] = [name]
  const address = (client?.address || '').trim()
  if (address) parts.push(address)
  const nip = (client?.nip || '').trim()
  if (nip) parts.push(`NIP: ${nip}`)

  return parts.join(', ')
}
