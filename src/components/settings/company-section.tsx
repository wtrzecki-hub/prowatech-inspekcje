"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Building, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface CompanyField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  mono?: boolean;
}

const COMPANY_KEYS: CompanyField[] = [
  { key: "company.name", label: "Nazwa firmy", placeholder: "ProWaTech Sp. z o.o.", required: true },
  { key: "company.short", label: "Skrócona nazwa", placeholder: "ProWaTech" },
  { key: "company.nip", label: "NIP", placeholder: "0000000000", mono: true },
  { key: "company.regon", label: "REGON", placeholder: "000000000", mono: true },
  { key: "company.address", label: "Adres siedziby", placeholder: "ul. Przykładowa 1, 00-000 Miasto" },
  { key: "company.email", label: "Email kontaktowy", placeholder: "kontakt@prowatech.pl", mono: true },
  { key: "company.phone", label: "Telefon", placeholder: "+48 000 000 000", mono: true },
  { key: "company.website", label: "Strona WWW", placeholder: "https://prowatech.pl", mono: true },
  { key: "company.logo_url", label: "URL logo (PDF/DOCX)", placeholder: "/logo-prowatech.png", mono: true },
];

export function CompanySection() {
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data, error: err } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "company.%");
      if (err) {
        // 42P01 = relation does not exist (migracja nie została uruchomiona)
        if (err.code === "42P01" || err.message?.includes("does not exist")) {
          setTableMissing(true);
        } else {
          setError(err.message);
        }
        setLoading(false);
        return;
      }
      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        const v = row.value;
        // value to jsonb — może być stringiem JSON ("foo") lub natywnym stringiem
        if (typeof v === "string") {
          map[row.key] = v;
        } else if (v === null) {
          map[row.key] = "";
        } else {
          map[row.key] = String(v);
        }
      });
      // Wypełnij brakujące klucze pustymi stringami
      COMPANY_KEYS.forEach((k) => {
        if (!(k.key in map)) map[k.key] = "";
      });
      setValues(map);
      setOriginal(map);
      setLoading(false);
    };
    load();
  }, []);

  const isDirty = Object.keys(values).some((k) => values[k] !== original[k]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);
    const supabase = createClient();

    // Upsert wszystkie klucze (nawet niezmodyfikowane to no-op)
    const rows = COMPANY_KEYS.map((k) => ({
      key: k.key,
      value: JSON.stringify(values[k.key] ?? ""),
    }));

    // jsonb przyjmuje natywny string — przekazujemy bezpośrednio (bez JSON.stringify wrapping)
    // Wzorzec: value = "string" w pg → '"string"'::jsonb. Supabase JS umie to zrobić jeśli pass jako obiekt.
    // Przerabiamy: przekażemy value jako string bez stringify — Supabase JS opakuje w jsonb
    const upsertRows = COMPANY_KEYS.map((k) => ({
      key: k.key,
      value: values[k.key] ?? "",
    }));

    const { error: err } = await supabase
      .from("app_settings")
      .upsert(upsertRows, { onConflict: "key" });

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOriginal(values);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (tableMissing) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-warning mx-auto" />
          <h3 className="text-base font-semibold text-graphite-900">
            Brak tabeli <code className="font-mono text-sm">app_settings</code>
          </h3>
          <p className="text-sm text-graphite-500 max-w-md mx-auto">
            Aby włączyć edycję danych firmy, uruchom migrację{" "}
            <code className="font-mono">migrations/2026-04-27_app_settings_table.sql</code>{" "}
            w Supabase SQL Editor (admin).
          </p>
          <p className="text-xs text-graphite-500">
            Migracja tworzy tabelę key/value z RLS i seed-uje klucze{" "}
            <code className="font-mono">company.*</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-5 w-5 text-graphite-500" />
            Dane firmy ProWaTech
          </CardTitle>
          <p className="text-xs text-graphite-500">
            Wartości pojawiają się w nagłówku protokołów PDF/DOCX. Generatory protokołów
            ciągną je z tabeli <code className="font-mono">app_settings</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {COMPANY_KEYS.map((field) => (
              <div
                key={field.key}
                className={field.label === "Adres siedziby" ? "md:col-span-2" : ""}
              >
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-danger ml-1">*</span>}
                </Label>
                <Input
                  id={field.key}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className={field.mono ? "font-mono" : ""}
                />
              </div>
            ))}
          </div>

          {values["company.logo_url"] && (
            <div className="rounded-lg border border-graphite-200 p-4 bg-graphite-50">
              <p className="text-xs font-semibold text-graphite-500 uppercase tracking-wider mb-2">
                Podgląd logo
              </p>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={values["company.logo_url"]}
                  alt="Logo"
                  className="h-12 w-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <a
                  href={values["company.logo_url"]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-info-800 hover:underline flex items-center gap-1"
                >
                  Otwórz w nowej karcie
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-success-100 bg-success-50 p-3 text-sm text-success-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Zapisano dane firmy
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-graphite-500">
              {isDirty ? "Niezapisane zmiany" : "Brak zmian do zapisania"}
            </p>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Zapisz dane firmy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-graphite-500 leading-relaxed">
            <strong className="text-graphite-700">TODO integracja z generatorami:</strong>{" "}
            obecne generatory PDF (<code className="font-mono">/api/pdf/[id]</code>) i DOCX
            (<code className="font-mono">/api/docx/[id]</code>) mają dane firmy hardkodowane.
            W kolejnej iteracji będą czytały <code className="font-mono">app_settings</code> przy każdym buildzie protokołu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
