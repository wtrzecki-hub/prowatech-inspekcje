'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createBrowserClient } from '@supabase/ssr'

interface ElectricalMeasurement {
  id: string
  inspection_id: string
  measurement_point: string
  grounding_resistance: number | null
  grounding_result: string | null
  insulation_resistance: number | null
  insulation_result: string | null
  loop_impedance: number | null
  loop_result: string | null
  rcd_time: number | null
  rcd_result: string | null
  pe_continuity: number | null
  pe_result: string | null
  measurement_date: string | null
  measured_by: string | null
  instrument_info: string | null
}

interface ElectricalMeasurementsProps {
  inspectionId: string
}

export function ElectricalMeasurements({
  inspectionId,
}: ElectricalMeasurementsProps) {
  const [measurements, setMeasurements] = useState<ElectricalMeasurement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [additionalFields, setAdditionalFields] = useState({
    measurement_date: '',
    measured_by: '',
    instrument_info: '',
  })
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadMeasurements()
  }, [inspectionId])

  const loadMeasurements = async () => {
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { data, error } = await supabase
        .from('electrical_measurements')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setMeasurements(data)
        setAdditionalFields({
          measurement_date: data[0].measurement_date || '',
          measured_by: data[0].measured_by || '',
          instrument_info: data[0].instrument_info || '',
        })
      }
    } catch (error) {
      console.error('Błąd podczas ładowania pomiarów:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMeasurementChange = async (
    id: string,
    field: keyof ElectricalMeasurement,
    value: any
  ) => {
    const newMeasurements = measurements.map((m) =>
      m.id === id ? { ...m, [field]: value } : m
    )
    setMeasurements(newMeasurements)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createBrowserClient(
          'https://lhxhsprqoecepojrxepf.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
        )

        const { error } = await supabase
          .from('electrical_measurements')
          .update({ [field]: value })
          .eq('id', id)

        if (error) throw error
      } catch (error) {
        console.error('Błąd przy aktualizacji pomiaru:', error)
      }
    }, 800)
  }

  const handleAdditionalFieldChange = async (
    field: 'measurement_date' | 'measured_by' | 'instrument_info',
    value: string
  ) => {
    setAdditionalFields((prev) => ({ ...prev, [field]: value }))

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const supabase = createBrowserClient(
          'https://lhxhsprqoecepojrxepf.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
        )

        for (const measurement of measurements) {
          const { error } = await supabase
            .from('electrical_measurements')
            .update({ [field]: value })
            .eq('id', measurement.id)

          if (error) throw error
        }
      } catch (error) {
        console.error('Błąd przy aktualizacji pola pomiarowego:', error)
      }
    }, 800)
  }

  const addMeasurement = async () => {
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { data, error } = await supabase
        .from('electrical_measurements')
        .insert([
          {
            inspection_id: inspectionId,
            measurement_point: `Punkt ${measurements.length + 1}`,
            measurement_date: additionalFields.measurement_date,
            measured_by: additionalFields.measured_by,
            instrument_info: additionalFields.instrument_info,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setMeasurements([...measurements, data])
    } catch (error) {
      console.error('Błąd przy dodawaniu pomiaru:', error)
    }
  }

  const deleteMeasurement = async (id: string) => {
    try {
      const supabase = createBrowserClient(
        'https://lhxhsprqoecepojrxepf.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoeGhzcHJxb2VjZXBvanJ4ZXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTE0NTksImV4cCI6MjA5MDYyNzQ1OX0.sb8WzlwpPAl4tj6CQgIH34PAQRklUmLeDFOMOS2kUi0'
      )

      const { error } = await supabase
        .from('electrical_measurements')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMeasurements(measurements.filter((m) => m.id !== id))
    } catch (error) {
      console.error('Błąd przy usuwaniu pomiaru:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-graphite-500">
        Ładowanie pomiarów elektrycznych...
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pomiary elektryczne</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Additional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-graphite-50 rounded-lg border border-graphite-200">
          <div className="space-y-2">
            <Label htmlFor="measurement-date" className="font-medium text-sm">
              Data pomiaru
            </Label>
            <Input
              id="measurement-date"
              type="date"
              value={additionalFields.measurement_date}
              onChange={(e) =>
                handleAdditionalFieldChange('measurement_date', e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="measured-by" className="font-medium text-sm">
              Pomiary przeprowadził
            </Label>
            <Input
              id="measured-by"
              placeholder="Imię i nazwisko"
              value={additionalFields.measured_by}
              onChange={(e) =>
                handleAdditionalFieldChange('measured_by', e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instrument-info" className="font-medium text-sm">
              Informacje o urządzeniu
            </Label>
            <Input
              id="instrument-info"
              placeholder="Model, seria, kalibracja"
              value={additionalFields.instrument_info}
              onChange={(e) =>
                handleAdditionalFieldChange('instrument_info', e.target.value)
              }
            />
          </div>
        </div>

        {/* Measurements Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-graphite-50 hover:bg-graphite-50 border-b border-graphite-200">
                <TableHead className="w-32">Punkt pomiarowy</TableHead>
                <TableHead className="text-center">Rezystancja uziemienia (Ω)</TableHead>
                <TableHead className="text-center">Wynik</TableHead>
                <TableHead className="text-center">Rezystancja izolacji (MΩ)</TableHead>
                <TableHead className="text-center">Wynik</TableHead>
                <TableHead className="text-center">Impedancja pętli (Ω)</TableHead>
                <TableHead className="text-center">Wynik</TableHead>
                <TableHead className="text-center">Czas RCD (ms)</TableHead>
                <TableHead className="text-center">Wynik</TableHead>
                <TableHead className="text-center">Ciągłość PE (Ω)</TableHead>
                <TableHead className="text-center">Wynik</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((measurement) => (
                <TableRow key={measurement.id} className="hover:bg-graphite-50/50 border-b border-graphite-100">
                  <TableCell>
                    <Input
                      value={measurement.measurement_point}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'measurement_point',
                          e.target.value
                        )
                      }
                      className="w-28 text-xs"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.1"
                      value={measurement.grounding_resistance || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'grounding_resistance',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="w-24 text-xs text-center"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      value={measurement.grounding_result || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'grounding_result',
                          e.target.value
                        )
                      }
                      className="w-20 text-xs text-center"
                      placeholder="OK/NOK"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.1"
                      value={measurement.insulation_resistance || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'insulation_resistance',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="w-24 text-xs text-center"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      value={measurement.insulation_result || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'insulation_result',
                          e.target.value
                        )
                      }
                      className="w-20 text-xs text-center"
                      placeholder="OK/NOK"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.01"
                      value={measurement.loop_impedance || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'loop_impedance',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="w-24 text-xs text-center"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      value={measurement.loop_result || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'loop_result',
                          e.target.value
                        )
                      }
                      className="w-20 text-xs text-center"
                      placeholder="OK/NOK"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="1"
                      value={measurement.rcd_time || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'rcd_time',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="w-20 text-xs text-center"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      value={measurement.rcd_result || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'rcd_result',
                          e.target.value
                        )
                      }
                      className="w-20 text-xs text-center"
                      placeholder="OK/NOK"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step="0.1"
                      value={measurement.pe_continuity || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'pe_continuity',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="w-20 text-xs text-center"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Input
                      value={measurement.pe_result || ''}
                      onChange={(e) =>
                        handleMeasurementChange(
                          measurement.id,
                          'pe_result',
                          e.target.value
                        )
                      }
                      className="w-20 text-xs text-center"
                      placeholder="OK/NOK"
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMeasurement(measurement.id)}
                      className="text-danger hover:text-danger-800 hover:bg-danger-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Add Button */}
        <Button
          onClick={addMeasurement}
          className="w-full"
        >
          <Plus size={18} className="mr-2" />
          Dodaj punkt pomiarowy
        </Button>
      </CardContent>
    </Card>
  )
}
