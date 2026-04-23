'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SliderProps {
  id?: string
  min?: number
  max?: number
  step?: number
  value?: number[]
  onValueChange?: (value: number[]) => void
  disabled?: boolean
  className?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      id,
      min = 0,
      max = 100,
      step = 1,
      value = [0],
      onValueChange,
      disabled,
      className,
    },
    ref
  ) => {
    return (
      <input
        ref={ref}
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
        disabled={disabled}
        className={cn(
          'w-full h-2 bg-graphite-200 rounded-lg appearance-none cursor-pointer accent-primary',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      />
    )
  }
)

Slider.displayName = 'Slider'

export { Slider }
