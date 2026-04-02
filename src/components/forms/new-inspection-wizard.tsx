"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Zod schemas for each step
const step1Schema = z.object({
  client_id: z.string().min(1, "Wybierz klienta"),
  wind_farm_id: z.string().min(1, "Wybierz farmę wiatrową"),
  turbine_id: z.string().min(1, "Wybierz turbinę"),
  inspection_type: z.enum(["roczna", "piecioletnia"], {
    errorMap: () => ({ message: "Wybierz typ kontroli" }),
  }),
  inspection_date: z.string().min(1, "Podaj datę inspekcji"),
})

const step2Schema = z.object({
  inspectors: z.array(
    z.object({
      id: z.string(),
      full_name: z.string(),
      selected: z.boolean(),
      specialty: z.string().optional(),
      is_lead: z.boolean().default(false),
    })
  ).refine((arr) => arr.some((i) => i.selected), "Wybierz co najmniej jednego inspektora"),
})

const step3Schema = z.object({
  previous_annual_date: z.string().optional(),
  previous_annual_protocol: z.string().optional(),
  previous_five_year_date: z.string().optional(),
  previous_findings: z.string().optional(),
  previous_recommendations_status: z.string().optional(),
})

const step4Schema = z.object({
  confirm: z.boolean().refine((val) => val === true, "Potwierdź aby kontynuować"),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>
type Step3Values = z.infer<typeof step3Schema>
type Step4Values = z.infer<typeof step4Schema>

interface Client {
  id: string
  name: string
}

interface WindFarm {
  id: string
  name: string
}

interface Turbine {
  id: string
  turbine_code: string
}

interface Inspector {
  id: string
  full_name: string
  specialty?: string
  is_active: boolean
}

interface InspectorSelection extends Inspector {
  selected: boolean
  is_lead: boolean
}

export function NewInspectionWizard() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Form states
  const [clients, setClients] = useState<Client[]>([])
  const [windFarms, setWindFarms] = useState<WindFarm[]>([])
  const [turbines, setTurbines] = useState<Turbine[]>([])
  const [inspectors, setInspectors] = useState<InspectorSelection[]>([])

  // Store form data across steps
  const [formData, setFormData] = useState({
    step1: {} as Step1Values,
    step2: {} as Step2Values,
    step3: {} as Step3Values,
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Step 1 form
  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      client_id: "",
      wind_farm_id: "",
      turbine_id: "",
      inspection_type: undefined,
      inspection_date: "",
    },
  })

  // Step 2 form
  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      inspectors: [],
    },
  })

  // Step 3 form
  const form3 = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      previous_annual_date: "",
      previous_annual_protocol: "",
      previous_five_year_date: "",
      previous_findings: "",
      previous_recommendations_status: "",
    },
  })

  // Step 4 form
  const form4 = useForm<Step4Values>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      confirm: false,
    },
  })

  // Initial load
  useEffect(() => {
    fetchClients()
    fetchInspectors()
  }, [])

  // Fetch clients
  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name")

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error(error)
      toast({
        title: "Błąd",
        description: "Nie udało się wczytać klientów",
        variant: "destructive",
      })
    }
  }

  // Fetch inspectors
  async function fetchInspectors() {
    try {
      const { data, error } = await supabase
        .from("inspectors")
        .select("id, full_name, specialty, is_active")
        .eq("is_active", true)
        .eq("is_deleted", false)
        .order("full_name")

      if (error) throw error
      setInspectors(
        (data || []).map((i) => ({
          ...i,
          selected: false,
          is_lead: false,
        }))
      )
    } catch (error) {
      console.error(error)
      toast({
        title: "Błąd",
        description: "Nie udało się wczytać inspektorów",
        variant: "destructive",
      })
    }
  }

  // Fetch wind farms for selected client
  async function handleClientChange(clientId: string) {
    form1.setValue("client_id", clientId)
    form1.setValue("wind_farm_id", "")
    form1.setValue("turbine_id", "")

    if (!clientId) {
      setWindFarms([])
      return
    }

    try {
      const { data, error } = await supabase
        .from("wind_farms")
        .select("id, name")
        .eq("client_id", clientId)
        .order("name")

      if (error) throw error
      setWindFarms(data || [])
    } catch (error) {
      console.error(error)
      toast({
        title: "Błąd",
        description: "Nie udało się wczytać farm wiatrowych",
        variant: "destructive",
      })
    }
  }

  // Fetch turbines for selected wind farm
  async function handleWindFarmChange(windFarmId: string) {
    form1.setValue("wind_farm_id", windFarmId)
    form1.setValue("turbine_id", "")

    if (!windFarmId) {
      setTurbines([])
      return
    }

    try {
      const { data, error } = await supabase
        .from("turbines")
        .select("id, turbine_code")
        .eq("wind_farm_id", windFarmId)
        .order("turbine_code")

      if (error) throw error
      setTurbines(data || [])
    } catch (error) {
      console.error(error)
      toast({
        title: "Błąd",
        description: "Nie udało się wczytać turbin",
        variant: "destructive",
      })
    }
  }

  // Handle step 1 submission
  function onStep1Submit(values: Step1Values) {
    setFormData((prev) => ({
      ...prev,
      step1: values,
    }))
    form2.setValue("inspectors", inspectors)
    setStep(2)
  }

  // Handle step 2 submission
  function onStep2Submit(values: Step2Values) {
    setFormData((prev) => ({
      ...prev,
      step2: values,
    }))
    setStep(3)
  }

  // Handle step 3 submission
  function onStep3Submit(values: Step3Values) {
    setFormData((prev) => ({
      ...prev,
      step3: values,
    }))
    setStep(4)
  }

  // Handle step 4 submission - Create inspection
  async function onStep4Submit() {
    try {
      setIsLoading(true)

      const selectedInspectors = formData.step2.inspectors.filter((i) => i.selected)

      // Create inspection
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .insert([
          {
            client_id: formData.step1.client_id,
            wind_farm_id: formData.step1.wind_farm_id,
            turbine_id: formData.step1.turbine_id,
            inspection_type: formData.step1.inspection_type,
            inspection_date: formData.step1.inspection_date,
            status: "draft",
            previous_annual_date: formData.step3.previous_annual_date || null,
            previous_annual_protocol: formData.step3.previous_annual_protocol || null,
            previous_five_year_date: formData.step3.previous_five_year_date || null,
            previous_findings: formData.step3.previous_findings || null,
            previous_recommendations_status: formData.step3.previous_recommendations_status || null,
          },
        ])
        .select("id")
        .single()

      if (inspectionError) throw inspectionError

      const inspectionId = inspectionData.id

      // Create inspection_inspectors records
      const inspectorRecords = selectedInspectors.map((inspector) => ({
        inspection_id: inspectionId,
        inspector_id: inspector.id,
        is_lead: inspector.is_lead,
        specialty: inspector.specialty || null,
      }))

      const { error: inspectorsError } = await supabase
        .from("inspection_inspectors")
        .insert(inspectorRecords)

      if (inspectorsError) throw inspectorsError

      toast({
        title: "Sukces",
        description: "Inspekcja została utworzona",
      })

      router.push(`/inspekcje/${inspectionId}`)
    } catch (error) {
      console.error(error)
      toast({
        title: "Błąd",
        description: error instanceof Error ? error.message : "Coś poszło nie tak",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInspectorToggle = (inspectorId: string) => {
    const updated = inspectors.map((i) =>
      i.id === inspectorId ? { ...i, selected: !i.selected } : i
    )
    setInspectors(updated)
    form2.setValue("inspectors", updated)
  }

  const handleIsLeadToggle = (inspectorId: string) => {
    const updated = inspectors.map((i) =>
      i.id === inspectorId ? { ...i, is_lead: !i.is_lead } : i
    )
    setInspectors(updated)
    form2.setValue("inspectors", updated)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                s === step
                  ? "bg-blue-600 text-white"
                  : s < step
                  ? "bg-green-600 text-white"
                  : "bg-gray-300 text-gray-700"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 4 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  s < step ? "bg-green-600" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Wybór turbiny i typu */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Krok 1: Wybór turbiny i typu inspekcji</CardTitle>
            <CardDescription>Wybierz klienta, farmę i turbinę</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form1}>
              <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                {/* Klient */}
                <FormField
                  control={form1.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Klient *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={handleClientChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz klienta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Farma wiatrowa */}
                <FormField
                  control={form1.control}
                  name="wind_farm_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Farma wiatrowa *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={handleWindFarmChange}
                        disabled={!form1.watch("client_id")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz farmę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {windFarms.map((farm) => (
                            <SelectItem key={farm.id} value={farm.id}>
                              {farm.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Turbina */}
                <FormField
                  control={form1.control}
                  name="turbine_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turbina *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!form1.watch("wind_farm_id")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz turbinę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {turbines.map((turbine) => (
                            <SelectItem key={turbine.id} value={turbine.id}>
                              {turbine.turbine_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Typ kontroli */}
                <FormField
                  control={form1.control}
                  name="inspection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Typ kontroli *</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz typ" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="roczna">Roczna</SelectItem>
                          <SelectItem value="piecioletnia">Pięcioletnia</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data inspekcji */}
                <FormField
                  control={form1.control}
                  name="inspection_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data inspekcji *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button type="submit">Dalej</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Przypisanie inspektorów */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Krok 2: Przypisanie inspektorów</CardTitle>
            <CardDescription>Wybierz inspektorów do przeprowadzenia inspekcji</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form2}>
              <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                <div className="space-y-3">
                  {inspectors.map((inspector) => (
                    <div
                      key={inspector.id}
                      className="flex items-start space-x-3 p-3 border rounded"
                    >
                      <Checkbox
                        id={`inspector-${inspector.id}`}
                        checked={inspector.selected}
                        onCheckedChange={() => handleInspectorToggle(inspector.id)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`inspector-${inspector.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {inspector.full_name}
                        </Label>
                        {inspector.specialty && (
                          <p className="text-sm text-gray-600">{inspector.specialty}</p>
                        )}
                      </div>
                      {inspector.selected && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`lead-${inspector.id}`}
                            checked={inspector.is_lead}
                            onCheckedChange={() => handleIsLeadToggle(inspector.id)}
                          />
                          <Label
                            htmlFor={`lead-${inspector.id}`}
                            className="text-sm cursor-pointer"
                          >
                            Główny
                          </Label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {form2.formState.errors.inspectors && (
                  <p className="text-sm text-red-600">
                    {form2.formState.errors.inspectors.message}
                  </p>
                )}

                <div className="flex gap-4">
                  <Button variant="outline" type="button" onClick={() => setStep(1)}>
                    Wstecz
                  </Button>
                  <Button type="submit">Dalej</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Dane poprzednich kontroli */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Krok 3: Dane poprzednich kontroli</CardTitle>
            <CardDescription>Podaj informacje o poprzednich inspekcjach</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form3}>
              <form onSubmit={form3.handleSubmit(onStep3Submit)} className="space-y-4">
                <FormField
                  control={form3.control}
                  name="previous_annual_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data ostatniej kontroli rocznej</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form3.control}
                  name="previous_annual_protocol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nr protokołu ostatniej rocznej</FormLabel>
                      <FormControl>
                        <Input placeholder="Np. P-2023-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form3.control}
                  name="previous_five_year_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data ostatniej kontroli 5-letniej</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form3.control}
                  name="previous_findings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ustalenia z poprzedniej kontroli</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Opisz ustalenia..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form3.control}
                  name="previous_recommendations_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status realizacji zaleceń</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Opisz status realizacji..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button variant="outline" type="button" onClick={() => setStep(2)}>
                    Wstecz
                  </Button>
                  <Button type="submit">Dalej</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Podsumowanie */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Krok 4: Podsumowanie i potwierdzenie</CardTitle>
            <CardDescription>Sprawdź dane przed utworzeniem inspekcji</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Summary data */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Dane turbiny i inspekcji</h4>
                  <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Typ kontroli:</span>{" "}
                      {formData.step1.inspection_type === "roczna"
                        ? "Roczna"
                        : "Pięcioletnia"}
                    </p>
                    <p>
                      <span className="font-medium">Data inspekcji:</span>{" "}
                      {formData.step1.inspection_date}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Przypisani inspektorzy</h4>
                  <div className="bg-gray-50 p-4 rounded space-y-1 text-sm">
                    {formData.step2.inspectors
                      .filter((i) => i.selected)
                      .map((i) => (
                        <p key={i.id}>
                          {i.full_name}
                          {i.is_lead && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Główny
                            </span>
                          )}
                        </p>
                      ))}
                  </div>
                </div>
              </div>

              {/* Confirmation checkbox */}
              <Form {...form4}>
                <form onSubmit={form4.handleSubmit(onStep4Submit)} className="space-y-4">
                  <FormField
                    control={form4.control}
                    name="confirm"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Potwierdzam poprawność danych
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {form4.formState.errors.confirm && (
                    <p className="text-sm text-red-600">
                      {form4.formState.errors.confirm.message}
                    </p>
                  )}

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setStep(3)}
                    >
                      Wstecz
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading || !form4.watch("confirm")}
                    >
                      {isLoading ? "Tworzenie..." : "Utwórz inspekcję"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
