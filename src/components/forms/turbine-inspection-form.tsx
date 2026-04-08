'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Wind,
  ClipboardCheck,
  Camera,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Calendar,
  User,
  Hash,
  ChevronRight,
  ChevronLeft,
  Upload,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

type InspectionStatus = 'ok' | 'warning' | 'failure' | null

interface ChecklistItem {
  id: string
  label: string
  category: string
  status: InspectionStatus
  notes: string
}

interface InspectionFormData {
  turbineId: string
  turbineCode: string
  location: string
  inspectionDate: string
  inspectorName: string
  checklist: ChecklistItem[]
  generalNotes: string
  photos: File[]
}

// ── Checklist definition ───────────────────────────────────────────

const CHECKLIST_ITEMS: Omit<ChecklistItem, 'status' | 'notes'>[] = [
  { id: 'blades', label: 'Stan łopat wirnika', category: 'Wirnik' },
  { id: 'aero_brake', label: 'Hamulec aerodynamiczny', category: 'Wirnik' },
  { id: 'hub', label: 'Piasta wirnika', category: 'Wirnik' },
  { id: 'generator', label: 'Generator', category: 'Gondola' },
  { id: 'gearbox', label: 'Przekładnia', category: 'Gondola' },
  { id: 'oil_leaks', label: 'Wycieki oleju', category: 'Gondola' },
  { id: 'yaw_system', label: 'Układ obrotu gondoli', category: 'Gondola' },
  { id: 'tower_ext', label: 'Wieża – stan zewnętrzny', category: 'Wieża' },
  { id: 'tower_int', label: 'Wieża – stan wewnętrzny', category: 'Wieża' },
  { id: 'tower_bolts', label: 'Połączenia śrubowe flanszy', category: 'Wieża' },
  { id: 'foundation', label: 'Fundament', category: 'Fundament' },
  { id: 'foundation_seal', label: 'Uszczelnienie wieża–fundament', category: 'Fundament' },
  { id: 'stairs', label: 'Schody i podesty', category: 'Bezpieczeństwo' },
  { id: 'safety_equip', label: 'Urządzenia ewakuacyjne', category: 'Bezpieczeństwo' },
  { id: 'fire_safety', label: 'Oznakowanie BHP i P-POŻ', category: 'Bezpieczeństwo' },
  { id: 'substation', label: 'Stacja kontenerowa', category: 'Infrastruktura' },
  { id: 'access_road', label: 'Droga dojazdowa i plac', category: 'Infrastruktura' },
]

// ── Component ──────────────────────────────────────────────────────

interface TurbineInspectionFormProps {
  turbineId?: string
  turbineCode?: string
  location?: string
  inspectorName?: string
  onSaveDraft?: (data: InspectionFormData) => void
  onSubmit?: (data: InspectionFormData) => void
}

export function TurbineInspectionForm({
  turbineId = '',
  turbineCode = '',
  location = '',
  inspectorName = '',
  onSaveDraft,
  onSubmit,
}: TurbineInspectionFormProps) {
  const [activeTab, setActiveTab] = useState('info')
  const [formData, setFormData] = useState<InspectionFormData>({
    turbineId,
    turbineCode,
    location,
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectorName,
    checklist: CHECKLIST_ITEMS.map((item) => ({
      ...item,
      status: null,
      notes: '',
    })),
    generalNotes: '',
    photos: [],
  })

  // ── Helpers ────────────────────────────────────────────────────

  const updateField = <K extends keyof InspectionFormData>(
    key: K,
    value: InspectionFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const updateChecklistStatus = (id: string, status: InspectionStatus) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id
          ? { ...item, status: item.status === status ? null : status }
          : item
      ),
    }))
  }

  const updateChecklistNotes = (id: string, notes: string) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, notes } : item
      ),
    }))
  }

  const completedCount = formData.checklist.filter((i) => i.status !== null).length
  const warningCount = formData.checklist.filter((i) => i.status === 'warning').length
  const failureCount = formData.checklist.filter((i) => i.status === 'failure').length

  // ── Handlers ───────────────────────────────────────────────────

  function handleSaveDraft() {
    console.log('💾 Zapisano roboczo:', formData)
    onSaveDraft?.(formData)
  }

  function handleSubmit() {
    console.log('✅ Zakończono inspekcję:', formData)
    onSubmit?.(formData)
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    updateField('photos', [...formData.photos, ...files])
  }

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
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">

        {/* Tab bar */}
        <TabsList className="grid w-full grid-cols-3 h-14 mb-4">
          <TabsTrigger value="info" className="h-12 text-sm gap-2 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Informacje</span>
            <span className="sm:hidden">Info</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="h-12 text-sm gap-2 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
            <Wind className="h-4 w-4" />
            <span className="hidden sm:inline">Stan techniczny</span>
            <span className="sm:hidden">Stan</span>
            {completedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {completedCount}/{formData.checklist.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="h-12 text-sm gap-2 data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Notatki</span>
            <span className="sm:hidden">Notatki</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Krok 1: Informacje ogólne ─────────────────────────── */}
        <TabsContent value="info" className="flex-1 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                Informacje ogólne
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="turbineId" className="flex items-center gap-2 text-base">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    ID turbiny
                  </Label>
                  <Input
                    id="turbineId"
                    value={formData.turbineId}
                    readOnly
                    className="h-12 text-base bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turbineCode" className="flex items-center gap-2 text-base">
                    <Wind className="h-4 w-4 text-muted-foreground" />
                    Kod turbiny
                  </Label>
                  <Input
                    id="turbineCode"
                    value={formData.turbineCode}
                    readOnly
                    className="h-12 text-base bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Lokalizacja
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="Miejscowość, gmina"
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data przeglądu
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.inspectionDate}
                    onChange={(e) => updateField('inspectionDate', e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="inspector" className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Inspektor
                  </Label>
                  <Input
                    id="inspector"
                    value={formData.inspectorName}
                    onChange={(e) => updateField('inspectorName', e.target.value)}
                    placeholder="Imię i nazwisko inspektora"
                    className="h-12 text-base"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Stan techniczny
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Krok 2: Stan techniczny ───────────────────────────── */}
        <TabsContent value="checklist" className="flex-1 mt-0">
          {/* Summary badges */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <Badge variant="outline" className="h-10 px-4 text-sm gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Sprawdzone: {completedCount}/{formData.checklist.length}
            </Badge>
            {warningCount > 0 && (
              <Badge className="h-10 px-4 text-sm gap-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300">
                <AlertTriangle className="h-4 w-4" />
                Ostrzeżenia: {warningCount}
              </Badge>
            )}
            {failureCount > 0 && (
              <Badge className="h-10 px-4 text-sm gap-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300">
                <XCircle className="h-4 w-4" />
                Awarie: {failureCount}
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3 pb-4">
              {(() => {
                let lastCategory = ''
                return formData.checklist.map((item) => {
                  const showCategory = item.category !== lastCategory
                  lastCategory = item.category
                  return (
                    <div key={item.id}>
                      {showCategory && (
                        <div className="pt-4 pb-2 first:pt-0">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            {item.category}
                          </h3>
                        </div>
                      )}
                      <Card className={`transition-colors ${
                        item.status === 'failure'
                          ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30'
                          : item.status === 'warning'
                            ? 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30'
                            : item.status === 'ok'
                              ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30'
                              : ''
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-base font-medium flex-1">{item.label}</span>
                              <div className="flex gap-2 flex-shrink-0">
                                <StatusButton
                                  status="ok"
                                  active={item.status === 'ok'}
                                  onClick={() => updateChecklistStatus(item.id, 'ok')}
                                />
                                <StatusButton
                                  status="warning"
                                  active={item.status === 'warning'}
                                  onClick={() => updateChecklistStatus(item.id, 'warning')}
                                />
                                <StatusButton
                                  status="failure"
                                  active={item.status === 'failure'}
                                  onClick={() => updateChecklistStatus(item.id, 'failure')}
                                />
                              </div>
                            </div>
                            {(item.status === 'warning' || item.status === 'failure') && (
                              <Textarea
                                placeholder="Opisz problem..."
                                value={item.notes}
                                onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
                                className="min-h-[60px] text-base resize-none"
                              />
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
              <ChevronLeft className="h-5 w-5" />
              Wróć
            </Button>
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Notatki
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Krok 3: Dokumentacja i Notatki ─────────────────────── */}
        <TabsContent value="notes" className="flex-1 mt-0">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Uwagi ogólne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Wpisz dodatkowe uwagi, spostrzeżenia, zalecenia..."
                  value={formData.generalNotes}
                  onChange={(e) => updateField('generalNotes', e.target.value)}
                  className="min-h-[200px] text-base resize-none"
                />
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
                <div className="space-y-4">
                  {formData.photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {formData.photos.map((file, i) => (
                        <div
                          key={i}
                          className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border relative group"
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Zdjęcie ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              updateField(
                                'photos',
                                formData.photos.filter((_, idx) => idx !== i)
                              )
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                          <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded">
                            {i + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Dotknij aby dodać zdjęcia
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      {formData.photos.length > 0
                        ? `Dodano: ${formData.photos.length} zdjęć`
                        : 'JPG, PNG do 10 MB'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between mt-6 gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" />
              Wróć
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Bottom action bar (sticky) ────────────────────────────── */}
      <div className="sticky bottom-0 bg-background border-t pt-4 pb-6 mt-6 flex gap-4">
        <Button
          onClick={handleSaveDraft}
          variant="outline"
          size="lg"
          className="h-14 flex-1 text-base gap-2"
        >
          <Save className="h-5 w-5" />
          Zapisz roboczo
        </Button>
        <Button
          onClick={handleSubmit}
          size="lg"
          className="h-14 flex-1 text-base gap-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
        >
          <CheckCircle2 className="h-5 w-5" />
          Zakończ inspekcję
        </Button>
      </div>
    </div>
  )
}

// ── Status toggle button ──────────────────────────────────────────

function StatusButton({
  status,
  active,
  onClick,
}: {
  status: 'ok' | 'warning' | 'failure'
  active: boolean
  onClick: () => void
}) {
  const config = {
    ok: {
      label: 'OK',
      icon: CheckCircle2,
      activeClass: 'bg-green-600 text-white border-green-600 dark:bg-green-700 dark:border-green-700',
      inactiveClass: 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30',
    },
    warning: {
      label: 'Uwaga',
      icon: AlertTriangle,
      activeClass: 'bg-yellow-500 text-white border-yellow-500 dark:bg-yellow-600 dark:border-yellow-600',
      inactiveClass: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-950/30',
    },
    failure: {
      label: 'Awaria',
      icon: XCircle,
      activeClass: 'bg-red-600 text-white border-red-600 dark:bg-red-700 dark:border-red-700',
      inactiveClass: 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30',
    },
  }

  const { label, icon: Icon, activeClass, inactiveClass } = config[status]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-4 py-3 rounded-lg border-2 font-medium text-sm
        transition-all duration-150 select-none
        min-h-[48px] min-w-[48px]
        ${active ? activeClass : inactiveClass}
      `}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
