'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserClient } from '@supabase/ssr'

interface ServiceInfo {
  id: string
  inspection_id: string
  service_company: string | null
  udt_certificate_number: string | null
  last_service_date: string | null
  last_service_protocol_number: string | null
  next_service_date: string | null
  service_protocols_in_kob: boolean
  notes: string | null
}

interface ServiceChecklistItem {
  id: string
  service_info_id: string
  item_name_pl: string
  is_checked: boolean
  notes: string | null
}

interface ServiceChecklistProps {
  inspectionId: string
}

export function ServiceChecklist({ inspectionId }: ServiceChecklistProps) {
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null)
  const [checklistItems, setChecklistItems] = useState<ServiceChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadData()
  }, [inspectionId])

  const loadData = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: info, error: infoError } = await supabase
        .from('service_info')
        .select('*')
        .eq('inspection_id', inspectionId)
        .single()

      if (infoError && infoError.code !== 'PGRST116') {
        throw infoError
      }

      if (info) {
        setServiceInfo(info)

        const { data: items, error: itemsError } = await supabase
          .from('service_checklist')
          .select('*')
          .eq('service_info_id', info.id)

        if (itemsError) throw itemsError
        setChecklistItems(items || [])
      }
    } catch (error) {
      console.error('Błąd podczas ładowania danych serwisu:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const ensureServiceInfo = async (): Promise<ServiceInfo | null> => {
    if (serviceInfo) return serviceInfo

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('service_info')
        .insert([{ inspection_id: inspectionId }])
        .select()
        .single()

      if (error) throw error
      setServiceInfo(data)
      return data
    } catch (error) {
      console.error('Błąd przy tworzeniu rekordu serwisu:', error)
      return null
    }
  }

  const handleServiceInfoChange = async (
    field: keyof ServiceInfo,
    value: any
  ) => {
    if (!serviceInfo) {
      const created = await ensureServiceInfo()
      if (!created) return
    }

    setIsSaving(true)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const updateData = serviceInfo || (await ensureServiceInfo())
        if (!updateData) return

        const { error } = await supabase
          .from('service_info')
          .update({ [field]: value })
          .eq('id', updateData.id)

        if (error) throw error

        setServiceInfo({ ...updateData, [field]: value })
      } catch (error) {
        console.error('Błąd podczas aktualizacji serwisu:', error)
      } finally {
        setIsSaving(false)
      }
    }, 800)
  }

  const handleChecklistChange = async (
    itemId: string,
    field: keyof ServiceChecklistItem,
    value: any
  ) => {
    const newItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    )
    setChecklistItems(newItems)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { error } = await supabase
          .from('service_checklist')
          .update({ [field]: value })
          .eq('id', itemId)

        if (error) throw error
      } catch (error) {
        console.error('Błąd przy aktualizacji pozycji listy:', error)
      }
    }, 800)
  }

  const addChecklistItem = async () => {
    if (!newItemName.trim()) return

    const info = serviceInfo || (await ensureServiceInfo())
    if (!info) return

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('service_checklist')
        .insert([
          {
            service_info_id: info.id,
            item_name_pl: newItemName,
            is_checked: false,
            notes: null,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setChecklistItems([...checklistItems, data])
      setNewItemName('')
    } catch (error) {
      console.error('Błąd przy dodawaniu pozycji listy:', error)
    }
  }

  const deleteChecklistItem = async (itemId: string) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase
        .from('service_checklist')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      setChecklistItems(checklistItems.filter((item) => item.id !== itemId))
    } catch (error) {
      console.error('Błąd przy usuwaniu pozycji listy:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Ładowanie informacji serwisu...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Service Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informacje serwisowe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-company" className="font-medium">
                Firma serwisowa
              </Label>
              <Input
                id="service-company"
                placeholder="Nazwa firmy serwisowej"
                value={serviceInfo?.service_company || ''}
                onChange={(e) =>
                  handleServiceInfoChange('service_company', e.target.value)
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="udt-cert" className="font-medium">
                Nr certyfikatu UDT
              </Label>
              <Input
                id="udt-cert"
                placeholder="Numer certyfikatu"
                value={serviceInfo?.udt_certificate_number || ''}
                onChange={(e) =>
                  handleServiceInfoChange(
                    'udt_certificate_number',
                    e.target.value
                  )
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last-service-date" className="font-medium">
                Data ostatniego serwisu
              </Label>
              <Input
                id="last-service-date"
                type="date"
                value={serviceInfo?.last_service_date || ''}
                onChange={(e) =>
                  handleServiceInfoChange('last_service_date', e.target.value)
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="protocol-number" className="font-medium">
                Nr protokołu serwisu
              </Label>
              <Input
                id="protocol-number"
                placeholder="Numer protokołu"
                value={serviceInfo?.last_service_protocol_number || ''}
                onChange={(e) =>
                  handleServiceInfoChange(
                    'last_service_protocol_number',
                    e.target.value
                  )
                }
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="next-service" className="font-medium">
                Następny serwis
              </Label>
              <Input
                id="next-service"
                type="date"
                value={serviceInfo?.next_service_date || ''}
                onChange={(e) =>
                  handleServiceInfoChange('next_service_date', e.target.value)
                }
                disabled={isSaving}
              />
            </div>

            <div className="flex items-end">
              <div className="flex items-center gap-3 h-10">
                <Checkbox
                  id="kob-protocols"
                  checked={serviceInfo?.service_protocols_in_kob || false}
                  onCheckedChange={(checked) =>
                    handleServiceInfoChange(
                      'service_protocols_in_kob',
                      checked
                    )
                  }
                  disabled={isSaving}
                />
                <Label
                  htmlFor="kob-protocols"
                  className="font-medium cursor-pointer"
                >
                  Protokoły w KOB
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-notes" className="font-medium">
              Uwagi
            </Label>
            <Textarea
              id="service-notes"
              placeholder="Dodatkowe uwagi dotyczące serwisu..."
              value={serviceInfo?.notes || ''}
              onChange={(e) => handleServiceInfoChange('notes', e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Checklist Card */}
      {serviceInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Checklist serwisowy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={item.is_checked}
                      onCheckedChange={(checked) =>
                        handleChecklistChange(item.id, 'is_checked', checked)
                      }
                    />
                    <div className="flex-1 pt-1">
                      <Label
                        htmlFor={`item-${item.id}`}
                        className={`font-medium cursor-pointer transition ${
                          item.is_checked
                            ? 'line-through text-gray-500'
                            : ''
                        }`}
                      >
                        {item.item_name_pl}
                      </Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChecklistItem(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>

                  <div className="ml-7 space-y-2">
                    <Label htmlFor={`notes-${item.id}`} className="text-sm">
                      Uwagi
                    </Label>
                    <Input
                      id={`notes-${item.id}`}
                      placeholder="Dodaj uwagi dotyczące tej pozycji..."
                      value={item.notes || ''}
                      onChange={(e) =>
                        handleChecklistChange(item.id, 'notes', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="new-item" className="font-medium">
                Dodaj nową pozycję
              </Label>
              <div className="flex gap-2">
                <Input
                  id="new-item"
                  placeholder="Nazwa pozycji checklist'u..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addChecklistItem()
                    }
                  }}
                />
                <Button
                  onClick={addChecklistItem}
                  disabled={!newItemName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus size={18} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
