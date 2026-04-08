'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wind, ClipboardCheck, Camera, FileText, Save, CheckCircle2,
  AlertTriangle, XCircle, MapPin, Calendar, User, ChevronRight,
  ChevronLeft, Upload, Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

type ConditionRating = 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null

interface ElementCheck {
  definitionId: string
  elementNumber: number
  sectionCode: string
  namePl: string
  rating: ConditionRating
  wearPercentage: number | null
  notes: string
  recommendations: string
}

interface TurbineOption {
  id: string
  turbine_code: string
  serial_number: string
  manufacturer: string
  model: string
  location_address: string
  wind_farms: { name: string }
}

interface ElementDefinition {
  id: string
  element_number: number
  section_code: string
  name_pl: string
  name_short: string
}

// ── Rating config ──────────────────────────────────────────────────

const RATINGS: { value: ConditionRating; label: string; color: string; activeColor: string; icon: typeof CheckCircle2 }[] = [
  { value: 'dobry', label: 'Dobry', color: 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400', activeColor: 'bg-green-600 text-white border-green-600', icon: CheckCircle2 },
  { value: 'zadowalajacy', label: 'Zadow.', color: 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400', activeColor: 'bg-blue-600 text-white border-blue-600', icon: CheckCircle2 },
  { value: 'sredni', label: 'Średni', color: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-400', activeColor: 'bg-yellow-500 text-white border-yellow-500', icon: AlertTriangle },
  { value: 'zly', label: 'Zły', color: 'border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400', activeColor: 'bg-orange-600 text-white border-orange-600', icon: XCircle },
  { value: 'awaryjny', label: 'Awaria', color: 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400', activeColor: 'bg-red-600 text-white border-red-600', icon: XCircle },
]

const SECTION_NAMES: Record<string, string> = {
  A: 'Konstrukcja',
  B: 'Bezpieczeństwo',
  C: 'Instalacje elektryczne',
  D: 'BHP i P-POŻ',
  E: 'Infrastruktura',
}

// ── Component ──────────────────────────────────────────────────────

interface Props {
  turbines: TurbineOption[]
  elementDefinitions: ElementDefinition[]
  preselectedTurbine?: TurbineOption | null
  inspectorName?: string
}

export function TurbineInspectionForm({ turbines, elementDefinitions, preselectedTurbine, inspectorName = '' }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('info')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [selectedTurbineId, setSelectedTurbineId] = useState(preselectedTurbine?.id || '')
  const [inspectionType, setInspectionType] = useState<'annual' | 'five_year'>('annual')
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [siteVisitDate, setSiteVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [inspector, setInspector] = useState(inspectorName)
  const [generalNotes, setGeneralNotes] = useState('')
  const [overallAssessment, setOverallAssessment] = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  const [elements, setElements] = useState<ElementCheck[]>(
    elementDefinitions.map((def) => ({
      definitionId: def.id,
      elementNumber: def.element_number,
      sectionCode: def.section_code,
      namePl: def.name_pl,
      rating: null,
      wearPercentage: null,
      notes: '',
      recommendations: '',
    }))
  )

  const selectedTurbine = turbines.find((t) => t.id === selectedTurbineId)
  const completedCount = elements.filter((e) => e.rating !== null).length
  const issueCount = elements.filter((e) => e.rating && !['dobry', 'zadowalajacy'].includes(e.rating)).length

  // ── Element updates ────────────────────────────────────────────

  function updateElement(defId: string, updates: Partial<ElementCheck>) {
    setElements((prev) => prev.map((el) => el.definitionId === defId ? { ...el, ...updates } : el))
  }

  // ── Save / Submit ──────────────────────────────────────────────

  async function saveInspection(status: 'draft' | 'in_progress' | 'completed') {
    if (!selectedTurbineId) {
      alert('Wybierz turbinę')
      return
    }

    const isSubmit = status === 'completed'
    if (isSubmit) setSubmitting(true)
    else setSaving(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Calculate overall rating
      const rated = elements.filter((e) => e.rating !== null)
      const ratingOrder: ConditionRating[] = ['awaryjny', 'zly', 'sredni', 'zadowalajacy', 'dobry']
      let worstRating: ConditionRating = rated.length > 0
        ? ratingOrder.find((r) => rated.some((e) => e.rating === r)) || null
        : null

      // Create inspection
      const { data: inspection, error: inspError } = await supabase
        .from('inspections')
        .insert({
          turbine_id: selectedTurbineId,
          inspection_type: inspectionType,
          status,
          inspection_date: inspectionDate,
          site_visit_date: siteVisitDate,
          committee_members: inspector,
          overall_condition_rating: worstRating,
          overall_assessment: overallAssessment || null,
          notes: generalNotes || null,
          created_by: session?.user.id,
        })
        .select('id')
        .single()

      if (inspError) throw inspError

      // Create inspection elements
      const elementRows = elements
        .filter((el) => el.rating !== null)
        .map((el) => ({
          inspection_id: inspection.id,
          element_definition_id: el.definitionId,
          condition_rating: el.rating,
          wear_percentage: el.wearPercentage,
          notes: el.notes || null,
          recommendations: el.recommendations || null,
        }))

      if (elementRows.length > 0) {
        const { error: elemError } = await supabase
          .from('inspection_elements')
          .insert(elementRows)

        if (elemError) throw elemError
      }

      // Upload photos to Supabase Storage
      if (photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i]
          const ext = file.name.split('.').pop() || 'jpeg'
          const path = `inspections/${inspection.id}/photo_${i + 1}.${ext}`

          const { error: uploadError } = await supabase.storage
            .from('turbine-photos')
            .upload(path, file, { contentType: file.type })

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('turbine-photos')
              .getPublicUrl(path)

            await supabase.from('inspection_photos').insert({
              inspection_id: inspection.id,
              photo_number: i + 1,
              file_url: urlData.publicUrl,
              description: `Zdjęcie ${i + 1}`,
              created_by: session?.user.id,
            })
          }
        }
      }

      // Update turbine's last inspection data
      if (status === 'completed') {
        await supabase
          .from('turbines')
          .update({
            last_inspection_date: inspectionDate,
            last_inspection_protocol: inspection.id,
          })
          .eq('id', selectedTurbineId)
      }

      if (isSubmit) {
        router.push(`/inspekcje`)
      } else {
        alert('Zapisano roboczo!')
      }
    } catch (error: any) {
      console.error('Błąd zapisu:', error)
      alert(`Błąd: ${error.message}`)
    } finally {
      setSaving(false)
      setSubmitting(false)
    }
  }

  // ── Navigation ─────────────────────────────────────────────────

  const goNext = () => {
    if (activeTab === 'info') setActiveTab('checklist')
    else if (activeTab === 'checklist') setActiveTab('notes')
  }
  const goPrev = () => {
    if (activeTab === 'notes') setActiveTab('checklist')
    else if (activeTab === 'checklist') setActiveTab('info')
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">

        <TabsList className="grid w-full grid-cols-3 h-14 mb-4">
          <TabsTrigger value="info" className="h-12 text-sm gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Informacje
          </TabsTrigger>
          <TabsTrigger value="checklist" className="h-12 text-sm gap-2">
            <Wind className="h-4 w-4" />
            Stan techniczny
            {completedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{completedCount}/{elements.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="h-12 text-sm gap-2">
            <FileText className="h-4 w-4" />
            Notatki
          </TabsTrigger>
        </TabsList>

        {/* ── Krok 1 ──────────────────────────────────────────────── */}
        <TabsContent value="info" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                Informacje ogólne
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 text-base">
                    <Wind className="h-4 w-4 text-muted-foreground" />
                    Turbina
                  </Label>
                  <Select value={selectedTurbineId} onValueChange={setSelectedTurbineId}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Wybierz turbinę..." />
                    </SelectTrigger>
                    <SelectContent>
                      {turbines.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.turbine_code} — {t.manufacturer} {t.model} ({t.wind_farms?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTurbine && (
                  <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                    <p><strong>Lokalizacja:</strong> {selectedTurbine.location_address}</p>
                    <p><strong>SN:</strong> {selectedTurbine.serial_number}</p>
                    <p><strong>Farma:</strong> {selectedTurbine.wind_farms?.name}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-base">Typ kontroli</Label>
                  <Select value={inspectionType} onValueChange={(v) => setInspectionType(v as 'annual' | 'five_year')}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Roczna</SelectItem>
                      <SelectItem value="five_year">Pięcioletnia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data przeglądu
                  </Label>
                  <Input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} className="h-12 text-base" />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Data wizji lokalnej
                  </Label>
                  <Input type="date" value={siteVisitDate} onChange={(e) => setSiteVisitDate(e.target.value)} className="h-12 text-base" />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Inspektor
                  </Label>
                  <Input value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="Imię i nazwisko" className="h-12 text-base" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Stan techniczny <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Krok 2 ──────────────────────────────────────────────── */}
        <TabsContent value="checklist" className="mt-0">
          <div className="flex gap-3 mb-4 flex-wrap">
            <Badge variant="outline" className="h-10 px-4 text-sm gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {completedCount}/{elements.length}
            </Badge>
            {issueCount > 0 && (
              <Badge className="h-10 px-4 text-sm gap-2 bg-red-100 text-red-800 border-red-300">
                <AlertTriangle className="h-4 w-4" /> Problemy: {issueCount}
              </Badge>
            )}
          </div>

          <ScrollArea>
            <div className="space-y-3 pb-4">
              {(() => {
                let lastSection = ''
                return elements.map((el) => {
                  const showSection = el.sectionCode !== lastSection
                  lastSection = el.sectionCode
                  const ratingConfig = RATINGS.find((r) => r.value === el.rating)

                  return (
                    <div key={el.definitionId}>
                      {showSection && (
                        <div className="pt-4 pb-2 first:pt-0">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            {el.sectionCode}. {SECTION_NAMES[el.sectionCode] || el.sectionCode}
                          </h3>
                        </div>
                      )}
                      <Card className={`transition-colors ${
                        el.rating === 'awaryjny' || el.rating === 'zly' ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30' :
                        el.rating === 'sredni' ? 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30' :
                        el.rating === 'dobry' || el.rating === 'zadowalajacy' ? 'border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20' : ''
                      }`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-base font-medium pt-2">
                                {el.elementNumber}. {el.namePl}
                              </span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {RATINGS.map((r) => (
                                <button
                                  key={r.value}
                                  type="button"
                                  onClick={() => updateElement(el.definitionId, {
                                    rating: el.rating === r.value ? null : r.value
                                  })}
                                  className={`flex items-center gap-1 px-3 py-2.5 rounded-lg border-2 font-medium text-xs transition-all min-h-[44px] ${
                                    el.rating === r.value ? r.activeColor : r.color
                                  }`}
                                >
                                  <r.icon className="h-3.5 w-3.5" />
                                  {r.label}
                                </button>
                              ))}
                            </div>
                            {el.rating && !['dobry', 'zadowalajacy'].includes(el.rating) && (
                              <div className="space-y-2 pt-1">
                                <Textarea
                                  placeholder="Opis stanu / uwagi..."
                                  value={el.notes}
                                  onChange={(e) => updateElement(el.definitionId, { notes: e.target.value })}
                                  className="min-h-[60px] text-base resize-none"
                                />
                                <Textarea
                                  placeholder="Zalecenia naprawcze..."
                                  value={el.recommendations}
                                  onChange={(e) => updateElement(el.definitionId, { recommendations: e.target.value })}
                                  className="min-h-[60px] text-base resize-none"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              })()}
            </div>
          </ScrollArea>

          <div className="flex justify-between mt-6 gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Notatki <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Krok 3 ──────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-0">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Ocena ogólna i uwagi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base">Ocena ogólna stanu technicznego</Label>
                  <Textarea
                    placeholder="Ogólna ocena stanu technicznego obiektu..."
                    value={overallAssessment}
                    onChange={(e) => setOverallAssessment(e.target.value)}
                    className="min-h-[120px] text-base resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Uwagi dodatkowe</Label>
                  <Textarea
                    placeholder="Dodatkowe spostrzeżenia, informacje o zagrożeniach..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="min-h-[120px] text-base resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Camera className="h-5 w-5 text-blue-600" />
                  Dokumentacja fotograficzna
                </CardTitle>
              </CardHeader>
              <CardContent>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                    {photos.map((file, i) => (
                      <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border relative group">
                        <img src={URL.createObjectURL(file)} alt={`Zdjęcie ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Dotknij aby dodać zdjęcia</span>
                  <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    setPhotos([...photos, ...files])
                  }} />
                </label>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between mt-6 gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Bottom action bar ──────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background border-t pt-4 pb-6 mt-6 flex gap-4">
        <Button
          onClick={() => saveInspection('draft')}
          variant="outline"
          size="lg"
          className="h-14 flex-1 text-base gap-2"
          disabled={saving || submitting}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Zapisz roboczo
        </Button>
        <Button
          onClick={() => saveInspection('completed')}
          size="lg"
          className="h-14 flex-1 text-base gap-2 bg-green-600 hover:bg-green-700"
          disabled={saving || submitting}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
          Zakończ inspekcję
        </Button>
      </div>
    </div>
  )
}
