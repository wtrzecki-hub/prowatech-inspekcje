'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * PIIB metryczka — kompozyt pól nagłówka protokołu wg Załącznika do uchwały
 * nr PIIB/KR/0051/2024 KR PIIB.
 *
 * Edycja wszystkich nowych kolumn metryczki w `inspections`:
 * - object_address, object_registry_number, object_name, object_photo_url
 * - owner_name, manager_name, contractor_info, additional_participants
 * - general_findings_intro, kob_entries_summary
 * - documents_reviewed (JSONB — 5 sub-pól: previous_annual, previous_5y,
 *   electrical_measurements, service, other)
 *
 * Self-contained: ładuje stan z DB, zapisuje 800ms na blur.
 */

interface DocumentsReviewed {
  previous_annual?: string
  previous_5y?: string
  electrical_measurements?: string
  service?: string
  other?: string
}

interface InspectionMetadata {
  object_address: string | null
  object_registry_number: string | null
  object_name: string | null
  object_photo_url: string | null
  owner_name: string | null
  manager_name: string | null
  contractor_info: string | null
  additional_participants: string | null
  general_findings_intro: string | null
  kob_entries_summary: string | null
  documents_reviewed: DocumentsReviewed | null
}

interface InspectionMetadataPiibProps {
  inspectionId: string
  /** Czy widoczna sekcja kob_entries_summary z opisem dla 5-letniej (5 lat) vs rocznej (12 mies.) */
  inspectionType?: 'annual' | 'five_year'
}

const SUPABASE_URL = 'https://lhxhsprqoecepojrxepf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'

const EMPTY_METADATA: InspectionMetadata = {
  object_address: null,
  object_registry_number: null,
  object_name: null,
  object_photo_url: null,
  owner_name: null,
  manager_name: null,
  contractor_info: null,
  additional_participants: null,
  general_findings_intro: null,
  kob_entries_summary: null,
  documents_reviewed: null,
}

export function InspectionMetadataPiib({
  inspectionId,
  inspectionType = 'annual',
}: InspectionMetadataPiibProps) {
  const [meta, setMeta] = useState<InspectionMetadata>(EMPTY_METADATA)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    void loadMetadata()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const supabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const loadMetadata = async () => {
    try {
      const { data, error } = await supabase()
        .from('inspections')
        .select(
          `object_address, object_registry_number, object_name, object_photo_url,
           owner_name, manager_name, contractor_info, additional_participants,
           general_findings_intro, kob_entries_summary, documents_reviewed`
        )
        .eq('id', inspectionId)
        .single()

      if (error) throw error
      if (data) {
        setMeta({
          ...EMPTY_METADATA,
          ...data,
          documents_reviewed:
            (data.documents_reviewed as DocumentsReviewed) || null,
        })
      }
    } catch (err) {
      console.error('Błąd ładowania metryczki PIIB:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const queueSave = (updates: Partial<InspectionMetadata>) => {
    setMeta((prev) => ({ ...prev, ...updates }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        const { error } = await supabase()
          .from('inspections')
          .update(updates)
          .eq('id', inspectionId)
        if (error) throw error
      } catch (err) {
        console.error('Błąd zapisu metryczki:', err)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleField = <K extends keyof InspectionMetadata>(
    field: K,
    value: InspectionMetadata[K]
  ) => {
    queueSave({ [field]: value } as Partial<InspectionMetadata>)
  }

  const handleDoc = (key: keyof DocumentsReviewed, value: string) => {
    const newDocs: DocumentsReviewed = {
      ...(meta.documents_reviewed || {}),
      [key]: value || undefined,
    }
    // Strip empty keys for clean JSON
    const cleanDocs: DocumentsReviewed = {}
    for (const [k, v] of Object.entries(newDocs)) {
      if (v) cleanDocs[k as keyof DocumentsReviewed] = v
    }
    queueSave({
      documents_reviewed:
        Object.keys(cleanDocs).length > 0 ? cleanDocs : null,
    })
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl border-graphite-200">
        <CardContent className="py-8 text-center text-graphite-500">
          Ładowanie metryczki…
        </CardContent>
      </Card>
    )
  }

  const docs = meta.documents_reviewed || {}

  return (
    <div className="space-y-6">
      {/* Sekcja 1: Metryczka obiektu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">Metryczka obiektu (PIIB)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="object_address" className="font-medium">
                Adres obiektu budowlanego
              </Label>
              <Input
                id="object_address"
                value={meta.object_address || ''}
                onChange={(e) => handleField('object_address', e.target.value || null)}
                placeholder="miejscowość, gmina, powiat, województwo, dz. ewid."
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="object_registry_number" className="font-medium">
                Numer ewidencyjny obiektu
              </Label>
              <Input
                id="object_registry_number"
                value={meta.object_registry_number || ''}
                onChange={(e) =>
                  handleField('object_registry_number', e.target.value || null)
                }
                placeholder="nadawany przez właściciela / zarządcę"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="object_name" className="font-medium">
                Nazwa obiektu / funkcja
              </Label>
              <Input
                id="object_name"
                value={meta.object_name || ''}
                onChange={(e) => handleField('object_name', e.target.value || null)}
                placeholder="np. elektrownia wiatrowa – turbina wiatrowa"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="object_photo_url" className="font-medium">
                URL fotografii ogólnej turbiny
              </Label>
              <Input
                id="object_photo_url"
                type="url"
                value={meta.object_photo_url || ''}
                onChange={(e) =>
                  handleField('object_photo_url', e.target.value || null)
                }
                placeholder="https://…"
              />
              {meta.object_photo_url && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={meta.object_photo_url}
                    alt="Fotografia obiektu"
                    className="rounded-md border border-graphite-200 max-h-48 object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 2: Strony protokołu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">Strony protokołu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="owner_name" className="font-medium">
                Właściciel obiektu
              </Label>
              <Input
                id="owner_name"
                value={meta.owner_name || ''}
                onChange={(e) => handleField('owner_name', e.target.value || null)}
                placeholder="imię i nazwisko / nazwa właściciela"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="manager_name" className="font-medium">
                Zarządca obiektu
              </Label>
              <Input
                id="manager_name"
                value={meta.manager_name || ''}
                onChange={(e) => handleField('manager_name', e.target.value || null)}
                placeholder="imię i nazwisko / nazwa zarządcy"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="contractor_info" className="font-medium">
                Wykonawca kontroli
              </Label>
              <Input
                id="contractor_info"
                value={meta.contractor_info || ''}
                onChange={(e) =>
                  handleField('contractor_info', e.target.value || null)
                }
                placeholder="imię i nazwisko / nr uprawnień / specjalność"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="additional_participants" className="font-medium">
                Przy udziale
              </Label>
              <Input
                id="additional_participants"
                value={meta.additional_participants || ''}
                onChange={(e) =>
                  handleField('additional_participants', e.target.value || null)
                }
                placeholder="przedstawiciel właściciela lub zarządcy"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 3: Dokumenty przedstawione do wglądu */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Dokumenty przedstawione do wglądu
          </CardTitle>
          <p className="text-sm text-graphite-500 font-normal">
            Czy okazano? Czy ważny? — opcjonalne notatki dla każdej pozycji.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label htmlFor="doc_previous_annual" className="font-medium">
                Protokół z poprzedniej kontroli rocznej
              </Label>
              <Input
                id="doc_previous_annual"
                value={docs.previous_annual || ''}
                onChange={(e) => handleDoc('previous_annual', e.target.value)}
                placeholder="np. okazano, z 14.05.2025, ważny"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc_previous_5y" className="font-medium">
                Protokół z poprzedniej kontroli 5-letniej
              </Label>
              <Input
                id="doc_previous_5y"
                value={docs.previous_5y || ''}
                onChange={(e) => handleDoc('previous_5y', e.target.value)}
                placeholder="np. okazano, z 03.06.2021, ważny"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc_electrical" className="font-medium">
                Protokoły pomiarów elektrycznych i odgromowych
              </Label>
              <Input
                id="doc_electrical"
                value={docs.electrical_measurements || ''}
                onChange={(e) =>
                  handleDoc('electrical_measurements', e.target.value)
                }
                placeholder="np. okazano, ważne 5 lat"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc_service" className="font-medium">
                Protokoły serwisowe (producent / autoryzowany serwis)
              </Label>
              <Input
                id="doc_service"
                value={docs.service || ''}
                onChange={(e) => handleDoc('service', e.target.value)}
                placeholder="np. okazano, cykliczność roczna"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc_other" className="font-medium">
                Inne dokumenty
              </Label>
              <Textarea
                id="doc_other"
                value={docs.other || ''}
                onChange={(e) => handleDoc('other', e.target.value)}
                placeholder="Inne dokumenty mające znaczenie dla oceny stanu technicznego…"
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sekcja 4: Wprowadzenie do II + KOB */}
      <Card className="rounded-xl border-graphite-200">
        <CardHeader>
          <CardTitle className="text-lg">
            Sprawdzenie wykonania zaleceń (wprowadzenie)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="general_findings_intro" className="font-medium">
              Tekst wprowadzający do sekcji II
            </Label>
            <Textarea
              id="general_findings_intro"
              value={meta.general_findings_intro || ''}
              onChange={(e) =>
                handleField('general_findings_intro', e.target.value || null)
              }
              placeholder="Opcjonalny tekst wprowadzający przed tabelą realizacji zaleceń…"
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="kob_entries_summary" className="font-medium">
              Wpisy w Książce Obiektu Budowlanego (KOB) za ostatnie{' '}
              {inspectionType === 'five_year' ? '5 lat' : '12 miesięcy'}
            </Label>
            <Textarea
              id="kob_entries_summary"
              value={meta.kob_entries_summary || ''}
              onChange={(e) =>
                handleField('kob_entries_summary', e.target.value || null)
              }
              placeholder="Podsumowanie wpisów w KOB…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {isSaving && (
        <p className="text-xs text-graphite-400 text-right">Zapisywanie…</p>
      )}
    </div>
  )
}
