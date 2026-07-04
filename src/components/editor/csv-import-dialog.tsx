'use client'

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Loader2, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { parseCSV, CSV_MAX_ROWS } from '@/modules/content/csv-shared'
import type { ValidatedRow } from '@/modules/content/csv-shared'
import { toPersianDigits } from '@/lib/jalali'

type Step = 'upload' | 'validate' | 'done'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [validated, setValidated] = useState<ValidatedRow[]>([])
  const [result, setResult] = useState<{ created: number; failed: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function reset() {
    setStep('upload')
    setValidated([])
    setResult(null)
  }

  const validateMutation = useMutation({
    mutationFn: async (rows: ReturnType<typeof parseCSV>) =>
      api.post('/api/content/import', { mode: 'validate', rows }) as Promise<{ validated: ValidatedRow[] }>,
    onSuccess: (data) => {
      setValidated(data.validated)
      setStep('validate')
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'خطا در بررسی فایل'),
  })

  const importMutation = useMutation({
    mutationFn: async (rows: ReturnType<typeof parseCSV>) =>
      api.post('/api/content/import', { mode: 'import', rows }) as Promise<{ created: number; failed: number }>,
    onSuccess: (data) => {
      setResult(data)
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'خطا در ایجاد پست‌ها'),
  })

  async function handleFile(file: File) {
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      toast.error('فایل خالی است یا فرمت نامعتبر دارد')
      return
    }
    if (rows.length > CSV_MAX_ROWS) {
      toast.error(`فایل ${toPersianDigits(rows.length)} ردیف دارد — حداکثر ${toPersianDigits(CSV_MAX_ROWS)} ردیف مجاز است. فایل را تقسیم کنید.`)
      return
    }
    validateMutation.mutate(rows)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file)
    } else {
      toast.error('فقط فایل CSV پذیرفته می‌شود')
    }
  }

  function confirmImport() {
    const validRows = validated.filter(r => r.valid)
    importMutation.mutate(validRows.map(r => r.data))
  }

  const validCount = validated.filter(r => r.valid).length
  const errorCount = validated.length - validCount
  const isPending = validateMutation.isPending || importMutation.isPending

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) { onOpenChange(v); if (!v) reset() } }}>
      <DialogContent className="max-w-2xl w-[min(672px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">وارد کردن دسته‌ای از CSV</DialogTitle>
          <DialogDescription className="text-sm text-ink-secondary">
            حداکثر ۲۰۰ پست — عنوان، متن، کانال‌ها، و زمان انتشار
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-ink-tertiary mb-2">
          {(['upload', 'validate', 'done'] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <span className="text-border">›</span>}
              <span className={cn(step === s && 'text-ink-primary font-semibold')}>
                {s === 'upload' ? 'آپلود' : s === 'validate' ? 'بررسی' : 'نتیجه'}
              </span>
            </span>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <a
              href="/api/content/import"
              download="nashrino-import-template.csv"
              className="n-focus-ring flex items-center gap-2 text-sm text-info hover:underline w-fit"
            >
              <Download className="size-4" />
              دانلود قالب CSV
            </a>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
                dragOver
                  ? 'border-info bg-info/5'
                  : 'border-border hover:border-info/50 hover:bg-surface-hover',
              )}
            >
              {validateMutation.isPending ? (
                <Loader2 className="size-8 text-info animate-spin" />
              ) : (
                <Upload className="size-8 text-ink-tertiary" />
              )}
              <p className="text-sm text-ink-secondary text-center">
                {validateMutation.isPending
                  ? 'در حال بررسی...'
                  : 'فایل CSV را بکشید اینجا یا کلیک کنید'}
              </p>
              <p className="text-xs text-ink-tertiary">UTF-8 · حداکثر ۲۰۰ ردیف</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          </div>
        )}

        {/* Step 2: Validate */}
        {step === 'validate' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-4" />
                {validCount} ردیف معتبر
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-danger">
                  <XCircle className="size-4" />
                  {errorCount} ردیف خطا
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-surface-hover sticky top-0">
                  <tr>
                    <th className="text-start ps-3 py-2 text-ink-tertiary font-medium">ردیف</th>
                    <th className="text-start ps-3 py-2 text-ink-tertiary font-medium">عنوان</th>
                    <th className="text-start ps-3 py-2 text-ink-tertiary font-medium">کانال‌ها</th>
                    <th className="text-start ps-3 py-2 text-ink-tertiary font-medium">زمان</th>
                    <th className="text-start ps-3 py-2 text-ink-tertiary font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validated.map((row) => (
                    <tr key={row.row} className={cn('hover:bg-surface-hover', !row.valid && 'bg-danger/5')}>
                      <td className="ps-3 py-2 text-ink-tertiary">{row.row}</td>
                      <td className="ps-3 py-2 text-ink-primary max-w-[160px] truncate">{row.data.title || '—'}</td>
                      <td className="ps-3 py-2 text-ink-secondary">{row.data.channels || '—'}</td>
                      <td className="ps-3 py-2 text-ink-secondary">{row.data.scheduledAt || 'پیش‌نویس'}</td>
                      <td className="ps-3 py-2">
                        {row.valid ? (
                          <CheckCircle2 className="size-3.5 text-success" />
                        ) : (
                          <span className="flex items-start gap-1 text-danger">
                            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                            <span className="break-words">{row.errors.map(e => e.message).join('، ')}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={reset} disabled={importMutation.isPending}>
                بازگشت
              </Button>
              <Button
                onClick={confirmImport}
                disabled={validCount === 0 || importMutation.isPending}
                className="min-h-[44px]"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="size-4 animate-spin ms-2" />در حال ایجاد...</>
                ) : (
                  `ایجاد ${validCount} پست`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="size-12 text-success" />
            <div>
              <p className="text-base font-semibold text-ink-primary">
                {result.created} پست با موفقیت ایجاد شد
              </p>
              {result.failed > 0 && (
                <p className="text-sm text-danger mt-1">{result.failed} پست ایجاد نشد</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}>
                <FileText className="size-4 ms-2" />
                وارد کردن فایل جدید
              </Button>
              <Button onClick={() => onOpenChange(false)}>بستن</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
