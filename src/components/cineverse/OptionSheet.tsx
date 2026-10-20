'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Option<T extends string | number> {
  value: T
  label: string
  hint?: string
  disabled?: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: Option<string | number>[]
  value?: string | number | null
  onSelect: (value: string | number) => void
}

/** Bottom-sheet style radio list — mirrors the quality/audio/subtitle sheets in the reference. */
export function OptionSheet({ open, onOpenChange, title, options, value, onSelect }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 top-auto h-auto max-h-[70%] translate-y-0 gap-0 overflow-y-auto thin-scrollbar rounded-b-none rounded-t-3xl border-x-0 border-b-0 bg-card p-0 data-[state=open]:animate-in data-[state=closed]:animate-out sm:bottom-0 sm:top-auto sm:translate-y-0 sm:w-[414px] sm:left-1/2 sm:-translate-x-1/2 sm:right-auto" style={{ maxWidth: 'calc(100vw - 0rem)' }}>
        <DialogHeader className="border-b border-border px-5 pb-3 pt-4">
          <DialogTitle className="text-right text-[15px] font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-2 py-2" role="radiogroup" aria-label={title}>
          {options.map((opt) => {
            const selected = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value)}
                role="radio"
                aria-checked={selected}
                disabled={opt.disabled}
                onClick={() => {
                  onSelect(opt.value)
                  onOpenChange(false)
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-right transition-colors',
                  selected ? 'bg-primary/10' : 'hover:bg-elevated/60',
                  opt.disabled && 'opacity-40'
                )}
              >
                <div className="flex flex-col">
                  <span className={cn('text-[13.5px] font-semibold', selected ? 'text-primary' : 'text-foreground')}>{opt.label}</span>
                  {opt.hint && <span className="text-[11px] text-muted-foreground">{opt.hint}</span>}
                </div>
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', selected ? 'border-primary bg-primary' : 'border-muted-foreground/40')}>
                  {selected && <Check className="h-3 w-3 text-primary-foreground" aria-hidden />}
                </span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
