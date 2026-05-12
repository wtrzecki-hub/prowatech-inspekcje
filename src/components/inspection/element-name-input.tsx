/**
 * Pole „Element / lokalizacja" w tabelach zaleceń — input + native
 * `<datalist>` z aktywnych elementów PIIB. Inspektor może wybrać
 * z listy albo wpisać własną wartość (np. „Wieża segment 2").
 *
 * Uwaga Artura 2026-05-12: legacy zalecenia z hpr nie mają element_name,
 * inspektor musi wpisać sam — datalist ułatwia bez wymuszania wartości
 * z listy.
 */

'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { useElementOptions } from '@/lib/zalecenia/use-element-options'

interface ElementNameInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function ElementNameInput({
  value,
  onChange,
  placeholder,
  className,
}: ElementNameInputProps) {
  const listId = useId()
  const { options } = useElementOptions()

  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'np. Fundament, Wieża'}
        className={className}
      />
      <datalist id={listId}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  )
}
