'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { SettingsData } from '@/lib/types'
import { useNav, useApp } from '@/lib/store'
import { ErrorState } from '../States'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const SERVERS: Array<{ value: string; label: string }> = [
  { value: 'vidlink', label: 'ویدلینک (پیشنهادی)' },
  { value: 'vidsrc-su', label: 'ویدسورس SU' },
  { value: 'vidsrc-xyz', label: 'ویدسورس XYZ' },
  { value: 'two-embed', label: 'توامبد' },
  { value: 'multiembed', label: 'مولتی‌امبد' },
  { value: 'vidsrc-to', label: 'ویدسورس TO' },
]

const QUALITIES: Array<{ value: string; label: string }> = [
  { value: 'auto', label: 'خودکار' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
]

const SUBTITLE_LANGS: Array<{ value: string; label: string }> = [
  { value: 'fa', label: 'فارسی' },
  { value: 'en', label: 'انگلیسی' },
  { value: 'off', label: 'خاموش' },
]

export function SettingsScreen() {
  const { pop } = useNav()
  const qc = useQueryClient()
  const local = useApp((s) => s.settings)
  const prevRef = useRef<SettingsData | null>(null)

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 60_000 })

  const update = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s)
      useApp.getState().setSettings(s)
    },
    onError: (e) => {
      // rollback to the snapshot taken before the optimistic update
      if (prevRef.current) useApp.getState().setSettings(prevRef.current)
      toast.error(e instanceof ApiError ? e.message : 'ذخیره تنظیمات ناموفق بود؛ دوباره تلاش کنید.')
    },
  })

  // sync fetched settings into the global store (used by the player defaults) —
  // only on first load; afterwards the optimistic store is the source of truth
  // and is kept fresh by the mutation's onSuccess.
  useEffect(() => {
    if (settingsQuery.data && !useApp.getState().settings) useApp.getState().setSettings(settingsQuery.data)
  }, [settingsQuery.data])

  useEffect(() => { document.title = 'تنظیمات — CineVerse' }, [])

  /** optimistic local update + server persist with rollback on error */
  function patch(p: Partial<SettingsData>) {
    const current = useApp.getState().settings ?? settingsQuery.data
    if (!current) return
    prevRef.current = current
    useApp.getState().setSettings({ ...current, ...p })
    update.mutate(p)
  }

  const s = local ?? settingsQuery.data

  if (!s) {
    if (settingsQuery.isError) {
      return (
        <div className="flex h-full flex-col">
          <Header onBack={pop} />
          <div className="pt-10"><ErrorState onRetry={() => settingsQuery.refetch()} /></div>
        </div>
      )
    }
    return (
      <div className="flex h-full flex-col">
        <Header onBack={pop} />
        <div className="space-y-2 p-4">{[...Array(7)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-elevated" />)}</div>
      </div>
    )
  }

  const serverLabel = SERVERS.find((o) => o.value === s.defaultServer)?.label ?? s.defaultServer
  const qualityLabel = QUALITIES.find((o) => o.value === s.defaultQuality)?.label ?? s.defaultQuality
  const subLabel = SUBTITLE_LANGS.find((o) => o.value === s.subtitleLang)?.label ?? s.subtitleLang

  return (
    <div className="flex h-full flex-col">
      <Header onBack={pop} />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <Group title="پخش">
          <SelectRow
            id="default-server"
            label="سرور پخش پیش‌فرض"
            hint="اگر سروری کار نکرد، داخل پخش‌کننده هم می‌توانید عوضش کنید"
            value={s.defaultServer}
            display={serverLabel}
            options={SERVERS}
            onChange={(v) => patch({ defaultServer: v })}
          />
          <SelectRow
            id="default-quality"
            label="کیفیت پیش‌فرض"
            value={s.defaultQuality}
            display={qualityLabel}
            options={QUALITIES}
            onChange={(v) => patch({ defaultQuality: v })}
          />
          <ToggleRow
            label="پخش خودکار قسمت بعد"
            checked={s.autoplayNext}
            onChange={(v) => patch({ autoplayNext: v })}
          />
          <ToggleRow
            label="حالت ذخیره داده (کم‌مصرف)"
            checked={s.dataSaver}
            onChange={(v) => patch({ dataSaver: v })}
          />
        </Group>

        <Group title="زیرنویس">
          <SelectRow
            id="subtitle-lang"
            label="زبان زیرنویس ترجیحی"
            value={s.subtitleLang}
            display={subLabel}
            options={SUBTITLE_LANGS}
            onChange={(v) => patch({ subtitleLang: v })}
          />
        </Group>

        <Group title="حریم خصوصی">
          <ToggleRow
            label="ذخیره تاریخچه تماشا"
            checked={s.saveHistory}
            onChange={(v) => patch({ saveHistory: v })}
          />
        </Group>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground/70">
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span>تغییرات بلافاصله ذخیره می‌شود.</span>
        </div>
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3.5">
      <button
        onClick={onBack}
        aria-label="بازگشت"
        className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-card"
      >
        <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
      <h1 className="text-[16px] font-black">تنظیمات</h1>
    </header>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-5">
      <h2 className="mb-2 px-1 text-[11px] font-bold text-muted-foreground">{title}</h2>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card/50">{children}</div>
    </section>
  )
}

function SelectRow({ id, label, hint, value, display, options, onChange }: {
  id: string
  label: string
  hint?: string
  value: string
  display: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-semibold">{label}</label>
        {hint && <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{hint}</p>}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          aria-label={label}
          className="h-10 w-[148px] shrink-0 rounded-xl border-white/10 bg-elevated/60 text-[12px]"
        >
          <SelectValue>{display}</SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-white/10 bg-popover">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-[12.5px]">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between px-4 py-3">
      <span className="text-[13px] font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
