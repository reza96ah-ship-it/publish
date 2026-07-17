'use client'

/**
 * صف انتشار — full-width publishing queue table (plan §2D).
 *
 * TanStack Table over /api/dashboard/pulse with: status + platform filters,
 * sorting, row selection, column visibility, pagination, density toggle,
 * accessible per-row DropdownMenu actions (retry / reconnect / cancel with
 * confirmation), live refetch that never resets sort/page/selection, and a
 * card layout under md. Honors the global platform filter (plan §10).
 */

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  ListOrdered,
  MoreHorizontal,
  RotateCcw,
  WifiOff,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Columns3,
  Clock3,
  Download,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { useDashboardFilters, PLATFORM_OPTIONS } from '@/lib/dashboard-filters'
import { trackClient } from '@/lib/track-client'
import { PanelHeader, EmptyState, ErrorState, PlatformIcon, LinkAction } from './shared'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface PulseJob {
  id: string
  title: string
  desc: string
  platform: string
  platformName: string
  status: string
  type: 'live' | 'success' | 'action' | 'scheduled'
  schedule: string | null
  processLabel: string | null
  progress: number
  errorCategory: string | null
  assignee: string
  assigneeAvatar: string
  campaign: string
  thumbnail: string
}

const STATUS_FILTERS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'live', label: 'در حال انتشار' },
  { value: 'scheduled', label: 'زمان‌بندی‌شده' },
  { value: 'action', label: 'انتشار ناموفق' },
  { value: 'success', label: 'منتشرشده' },
]

const TYPE_TONE: Record<PulseJob['type'], string> = {
  live: 'text-accent bg-accent-soft border-accent/20',
  action: 'text-danger bg-danger-soft border-danger/20',
  success: 'text-success bg-success-soft border-success/20',
  scheduled: 'text-info bg-info-soft border-info/20',
}

const COLUMN_LABELS: Record<string, string> = {
  content: 'محتوا',
  platform: 'شبکه',
  schedule: 'زمان انتشار',
  status: 'وضعیت',
  campaign: 'کمپین',
  assignee: 'مسئول',
  detail: 'جزئیات',
}

export function PublishingTable() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { platform } = useDashboardFilters()

  const { data, isLoading, isError, refetch } = useQuery<PulseJob[]>({
    queryKey: ['dashboard-pulse'],
    queryFn: () => api.get<PulseJob[]>('/api/dashboard/pulse'),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  })

  const retryMutation = useMutation({
    mutationFn: (job: { id: string; platform: string }) =>
      api.patch(`/api/publish-jobs/${job.id}`, { action: 'retry' }),
    onMutate: (job) => {
      trackClient('publishing_retry_started', { jobId: job.id, platformType: job.platform })
    },
    onSuccess: () => {
      toast.success('کار برای تلاش مجدد به صف بازگردانده شد')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
    },
    onError: () => toast.error('خطا در تلاش مجدد'),
  })

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => api.patch(`/api/publish-jobs/${jobId}`, { action: 'cancel' }),
    onSuccess: () => {
      toast.success('انتشار لغو شد')
      queryClient.invalidateQueries({ queryKey: ['dashboard-pulse'] })
    },
    onError: () => toast.error('خطا در لغو انتشار'),
  })

  // Table state lives outside the data — refetches never reset it.
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [cancelTarget, setCancelTarget] = useState<PulseJob | null>(null)
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false)

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (j) =>
          (statusFilter === 'all' || j.type === statusFilter) &&
          (platform === 'all' || j.platform === platform)
      ),
    [data, statusFilter, platform]
  )

  const columns = useMemo<ColumnDef<PulseJob>[]>(
    () => [
      {
        id: 'select',
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="انتخاب همه ردیف‌ها"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={`انتخاب ${row.original.title}`}
          />
        ),
      },
      {
        id: 'content',
        accessorKey: 'title',
        enableHiding: false,
        header: 'محتوا',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5 min-w-0">
            {row.original.thumbnail ? (
              <Image
                src={row.original.thumbnail}
                alt=""
                width={32}
                height={32}
                unoptimized={row.original.thumbnail.startsWith('http')}
                className="size-8 rounded-md object-cover shrink-0"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-md bg-surface-hover shrink-0">
                <PlatformIcon platform={row.original.platform} className="size-4" />
              </div>
            )}
            <span className="text-sm font-semibold text-ink-primary truncate max-w-[220px]">
              {row.original.title}
            </span>
          </div>
        ),
      },
      {
        id: 'platform',
        accessorKey: 'platformName',
        header: 'شبکه',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <PlatformIcon platform={row.original.platform} className="size-4" />
            {row.original.platformName}
          </span>
        ),
      },
      {
        id: 'schedule',
        accessorKey: 'schedule',
        header: ({ column }) => (
          <button
            type="button"
            className="n-focus-ring inline-flex items-center gap-1 font-semibold rounded"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            زمان انتشار
            <ArrowUpDown className="size-3" aria-hidden />
          </button>
        ),
        cell: ({ row }) =>
          row.original.schedule ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-secondary num-tabular">
              <Clock3 className="size-3 text-ink-tertiary" aria-hidden />
              {relativeTime(new Date(row.original.schedule))}
            </span>
          ) : (
            <span className="text-xs text-ink-tertiary">—</span>
          ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${TYPE_TONE[row.original.type]}`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: 'campaign',
        accessorKey: 'campaign',
        header: 'کمپین',
        cell: ({ row }) => (
          <span className="text-xs text-ink-secondary truncate max-w-[120px] inline-block">
            {row.original.campaign}
          </span>
        ),
      },
      {
        id: 'assignee',
        accessorKey: 'assignee',
        header: 'مسئول',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            {row.original.assigneeAvatar && (
              <Image
                src={row.original.assigneeAvatar}
                alt=""
                width={20}
                height={20}
                unoptimized={row.original.assigneeAvatar.startsWith('http')}
                className="size-5 rounded-full"
              />
            )}
            <span className="truncate max-w-[100px]">{row.original.assignee}</span>
          </span>
        ),
      },
      {
        id: 'detail',
        header: 'جزئیات',
        cell: ({ row }) => {
          const j = row.original
          if (j.type === 'live') {
            return (
              <div className="flex items-center gap-2 min-w-[110px]">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${j.progress}%` }}
                  />
                </div>
                <span className="text-2xs font-semibold text-ink-secondary num-tabular">
                  {toPersianDigits(j.progress)}٪
                </span>
              </div>
            )
          }
          if (j.type === 'action') {
            return (
              <span className="text-2xs text-danger">
                {j.errorCategory === 'auth' ? 'خطای احراز هویت' : 'خطای انتشار'}
              </span>
            )
          }
          return <span className="text-2xs text-ink-tertiary">{j.processLabel ?? '—'}</span>
        },
      },
      {
        id: 'actions',
        enableHiding: false,
        header: () => <span className="sr-only">اقدامات</span>,
        cell: ({ row }) => {
          const j = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`اقدامات ${j.title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {j.type === 'action' && j.errorCategory !== 'auth' && (
                  <DropdownMenuItem onClick={() => retryMutation.mutate({ id: j.id, platform: j.platform })}>
                    <RotateCcw className="size-3.5 me-2" />
                    تلاش مجدد
                  </DropdownMenuItem>
                )}
                {j.type === 'action' && j.errorCategory === 'auth' && (
                  <DropdownMenuItem onClick={() => router.push('/channels')}>
                    <WifiOff className="size-3.5 me-2" />
                    اتصال مجدد
                  </DropdownMenuItem>
                )}
                {(j.type === 'scheduled' || j.type === 'live' || j.type === 'action') && (
                  <DropdownMenuItem
                    className="text-danger focus:text-danger"
                    onClick={() => setCancelTarget(j)}
                  >
                    <X className="size-3.5 me-2" />
                    لغو انتشار
                  </DropdownMenuItem>
                )}
                {j.type === 'success' && (
                  <DropdownMenuItem onClick={() => router.push('/analytics')}>
                    مشاهده عملکرد
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = `/api/publish-jobs/${j.id}/export`
                    a.download = ''
                    a.click()
                  }}
                >
                  <Download className="size-3.5 me-2" />
                  دانلود برای انتشار دستی
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [retryMutation, router]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  })

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const selectedCount = selectedRows.length
  const bulkRetryable = selectedRows.filter(
    (j) => j.type === 'action' && j.errorCategory !== 'auth'
  )
  const bulkCancellable = selectedRows.filter((j) =>
    ['scheduled', 'live', 'action'].includes(j.type)
  )
  const cellPad = density === 'compact' ? 'py-1.5' : 'py-2.5'

  if (isError) {
    return <ErrorState label="دریافت صف انتشار با مشکل روبه‌رو شد" onRetry={() => refetch()} />
  }

  return (
    <div className="n-card p-5">
      <PanelHeader
        icon={ListOrdered}
        title="صف انتشار"
        subtitle="انتشارهای فعال و زمان‌بندی‌شده"
        action={<LinkAction onClick={() => router.push('/calendar')}>مشاهده تقویم ←</LinkAction>}
      />

      {/* Toolbar: status filter · density · column visibility */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs" aria-label="فیلتر وضعیت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <>
              <span className="text-xs text-ink-secondary num-tabular">
                {toPersianDigits(selectedCount)} ردیف انتخاب شده
              </span>
              {bulkRetryable.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    trackClient('publishing_bulk_retry_started', { count: bulkRetryable.length })
                    bulkRetryable.forEach((j) =>
                      retryMutation.mutate({ id: j.id, platform: j.platform })
                    )
                    setRowSelection({})
                  }}
                >
                  <RotateCcw className="size-3" />
                  تلاش مجدد ({toPersianDigits(bulkRetryable.length)})
                </Button>
              )}
              {bulkCancellable.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-danger hover:text-danger border-danger/30 hover:bg-danger-soft"
                  onClick={() => setBulkCancelOpen(true)}
                >
                  <X className="size-3" />
                  لغو ({toPersianDigits(bulkCancellable.length)})
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-ink-tertiary"
                onClick={() => setRowSelection({})}
                aria-label="پاک کردن انتخاب"
              >
                <X className="size-3.5" />
              </Button>
            </>
          )}
          <ToggleGroup
            type="single"
            value={density}
            onValueChange={(v) => v && setDensity(v as typeof density)}
            className="hidden md:flex"
          >
            <ToggleGroupItem value="comfortable" aria-label="نمای راحت" className="h-8 px-2 text-2xs">
              راحت
            </ToggleGroupItem>
            <ToggleGroupItem value="compact" aria-label="نمای فشرده" className="h-8 px-2 text-2xs">
              فشرده
            </ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs hidden md:inline-flex"
                aria-label="نمایش ستون‌ها"
              >
                <Columns3 className="size-3.5" />
                ستون‌ها
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>ستون‌های جدول</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {COLUMN_LABELS[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <Table aria-label="جدول صف انتشار">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-start text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cellPad}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  {isLoading ? (
                    <span className="text-sm text-ink-tertiary">در حال بارگذاری…</span>
                  ) : (
                    <EmptyState
                      icon={Clock3}
                      title="صف انتشار خالی است"
                      message="انتشارهای فعال و زمان‌بندی‌شده در این بخش نمایش داده می‌شوند."
                      size="compact"
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {table.getRowModel().rows.map((row) => {
          const j = row.original
          return (
            <div key={j.id} className="n-card-compact p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <PlatformIcon platform={j.platform} className="size-4" />
                <span className="text-sm font-semibold text-ink-primary truncate flex-1">
                  {j.title}
                </span>
                <span
                  className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border whitespace-nowrap ${TYPE_TONE[j.type]}`}
                >
                  {j.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-2xs text-ink-tertiary">
                <span>{j.campaign}</span>
                <span className="num-tabular">
                  {j.schedule ? relativeTime(new Date(j.schedule)) : (j.processLabel ?? '')}
                </span>
              </div>
              {j.type === 'action' && (
                <div className="mt-2 flex items-center gap-1.5">
                  {j.errorCategory !== 'auth' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] px-3 text-xs"
                      onClick={() => retryMutation.mutate({ id: j.id, platform: j.platform })}
                    >
                      <RotateCcw className="size-3 me-1" />
                      تلاش مجدد
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] px-3 text-xs"
                      onClick={() => router.push('/channels')}
                    >
                      <WifiOff className="size-3 me-1" />
                      اتصال مجدد
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && !isLoading && (
          <EmptyState
            icon={Clock3}
            title="صف انتشار خالی است"
            message="انتشارهای فعال و زمان‌بندی‌شده در این بخش نمایش داده می‌شوند."
            size="compact"
          />
        )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-ink-tertiary num-tabular">
            صفحه {toPersianDigits(table.getState().pagination.pageIndex + 1)} از{' '}
            {toPersianDigits(table.getPageCount())}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="صفحه قبل"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="صفحه بعد"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk cancel confirmation */}
      <AlertDialog open={bulkCancelOpen} onOpenChange={setBulkCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              لغو {toPersianDigits(bulkCancellable.length)} انتشار؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              این انتشارها از صف خارج می‌شوند. این اقدام قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => {
                trackClient('publishing_bulk_cancel_started', { count: bulkCancellable.length })
                bulkCancellable.forEach((j) => cancelMutation.mutate(j.id))
                setRowSelection({})
                setBulkCancelOpen(false)
              }}
            >
              لغو همه
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single-row destructive confirmation (plan §2D: تأیید برای اقدامات مخرب) */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>لغو انتشار «{cancelTarget?.title}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              این انتشار از صف خارج می‌شود. این اقدام قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => {
                if (cancelTarget) cancelMutation.mutate(cancelTarget.id)
                setCancelTarget(null)
              }}
            >
              لغو انتشار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
