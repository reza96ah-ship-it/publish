'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, Copy, Check, ChevronDown, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { buildUtmPreview, isValidUrl, displayDomain } from '@/lib/utm'
import { cn } from '@/lib/utils'

interface UtmPreset {
  id: string
  name: string
  source: string
  medium: string
  campaign: string
  term: string
  content: string
}

interface UtmBuilderProps {
  initialUrl?: string
  onUrlChange?: (url: string) => void
  className?: string
}

export function UtmBuilder({ initialUrl = '', onUrlChange, className }: UtmBuilderProps) {
  const [url, setUrl] = useState(initialUrl)
  const [source, setSource] = useState('')
  const [medium, setMedium] = useState('')
  const [campaign, setCampaign] = useState('')
  const [term, setTerm] = useState('')
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { data: presets = [] } = useQuery<UtmPreset[]>({
    queryKey: ['utm-presets'],
    queryFn: () => api('/api/utm-presets'),
  })

  const finalUrl = buildUtmPreview(url, { source, medium, campaign, term, content })
  const urlValid = !url || isValidUrl(url)
  const hasParams = source || medium

  function applyPreset(preset: UtmPreset) {
    setSource(preset.source)
    setMedium(preset.medium)
    setCampaign(preset.campaign)
    setTerm(preset.term)
    setContent(preset.content)
  }

  function handleUrlChange(v: string) {
    setUrl(v)
    onUrlChange?.(hasParams ? buildUtmPreview(v, { source, medium, campaign, term, content }) : v)
  }

  async function copyUrl() {
    if (!finalUrl) return
    await navigator.clipboard.writeText(finalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* URL input */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-ink-secondary">لینک پیوند</Label>
        <div className="relative">
          <Link2 className="absolute start-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-tertiary" />
          <Input
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/landing-page"
            className={cn('ps-8 text-sm', !urlValid && 'border-danger focus-visible:ring-danger')}
            dir="ltr"
          />
        </div>
        {!urlValid && (
          <p className="text-2xs text-danger">لینک معتبر نیست</p>
        )}
      </div>

      {/* Preset selector */}
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-ink-secondary">پیش‌تنظیم UTM</Label>
          <Select onValueChange={(id) => {
            const p = presets.find((x) => x.id === id)
            if (p) applyPreset(p)
          }}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="انتخاب پیش‌تنظیم…" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    <span className="text-xs text-ink-tertiary">{p.source}/{p.medium}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* UTM fields — collapsible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary transition-colors n-focus-ring rounded"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
        پارامترهای UTM
        {hasParams && <span className="size-1.5 rounded-full bg-accent" />}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'منبع (source)', value: source, set: setSource, placeholder: 'instagram' },
            { label: 'رسانه (medium)', value: medium, set: setMedium, placeholder: 'social' },
            { label: 'کمپین (campaign)', value: campaign, set: setCampaign, placeholder: 'summer_sale' },
            { label: 'محتوا (content)', value: content, set: setContent, placeholder: 'video_post' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label} className="space-y-1">
              <Label className="text-2xs text-ink-tertiary">{label}</Label>
              <Input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="text-xs h-8"
                dir="ltr"
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview + copy */}
      {url && hasParams && urlValid && (
        <div className="rounded-lg bg-surface-subtle border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-ink-tertiary">پیش‌نمایش URL</span>
            <div className="flex items-center gap-1">
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs text-accent hover:underline flex items-center gap-0.5 n-focus-ring rounded"
              >
                <ExternalLink className="size-3" />
                باز کردن
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyUrl}
                className="h-6 px-2 text-2xs"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                {copied ? 'کپی شد' : 'کپی'}
              </Button>
            </div>
          </div>
          <p className="text-2xs text-ink-secondary break-all font-mono leading-relaxed" dir="ltr">
            {finalUrl}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-2xs text-ink-tertiary">{displayDomain(url)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
