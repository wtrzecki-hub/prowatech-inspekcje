'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TurbineInspectionForm } from '@/components/forms/turbine-inspection-form'
import { Skeleton } from '@/components/ui/skeleton'

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

export default function NewInspectionPage() {
  const searchParams = useSearchParams()
  const preselectedTurbineId = searchParams.get('turbine_id')

  const [turbines, setTurbines] = useState<TurbineOption[]>([])
  const [elementDefinitions, setElementDefinitions] = useState<ElementDefinition[]>([])
  const [selectedTurbine, setSelectedTurbine] = useState<TurbineOption | null>(null)
  const [inspectorName, setInspectorName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()

    // Fetch turbines, element definitions, and current user in parallel
    const [turbinesRes, defsRes, sessionRes] = await Promise.all([
      supabase
        .from('turbines')
        .select('id, turbine_code, serial_number, manufacturer, model, location_address, wind_farms(name)')
        .not('is_deleted', 'is', true)
        .order('turbine_code'),
      supabase
        .from('inspection_element_definitions')
        .select('id, element_number, section_code, name_pl, name_short')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.auth.getSession(),
    ])

    if (turbinesRes.data) setTurbines(turbinesRes.data as TurbineOption[])
    if (defsRes.data) setElementDefinitions(defsRes.data)

    // Get inspector name from profile
    if (sessionRes.data.session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', sessionRes.data.session.user.id)
        .single()
      if (profile) setInspectorName(profile.full_name || '')
    }

    // Preselect turbine if turbine_id in URL
    if (preselectedTurbineId && turbinesRes.data) {
      const found = turbinesRes.data.find((t: any) => t.id === preselectedTurbineId)
      if (found) setSelectedTurbine(found as TurbineOption)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nowa inspekcja</h1>
        <p className="text-muted-foreground mt-2">
          Utwórz nową inspekcję techniczną turbiny wiatrowej
        </p>
      </div>

      <TurbineInspectionForm
        turbines={turbines}
        elementDefinitions={elementDefinitions}
        preselectedTurbine={selectedTurbine}
        inspectorName={inspectorName}
      />
    </div>
  )
}
