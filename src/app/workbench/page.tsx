import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AlertCircle, Info } from 'lucide-react'
import type { ReactNode } from 'react'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-primary border-b border-border pb-2">{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 flex-wrap py-2">
      <span className="text-xs text-ink-tertiary w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}

export default function WorkbenchPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-xl font-bold text-ink-primary">Component Workbench</h1>
        <p className="text-sm text-ink-secondary mt-1">کتابخانه کامپوننت‌های نشرینو — فقط در حالت توسعه قابل دسترس است</p>
      </div>

      <Section title="Typography — تایپوگرافی">
        <div className="space-y-2">
          <p className="text-2xl font-bold text-ink-primary">text-2xl — عنوان نمایشگر / KPI</p>
          <p className="text-xl font-semibold text-ink-primary">text-xl — عنوان صفحه</p>
          <p className="text-lg font-semibold text-ink-primary">text-lg — عنوان بخش / کارت</p>
          <p className="text-base text-ink-primary">text-base — متن اصلی / برچسب فرم</p>
          <p className="text-sm text-ink-secondary">text-sm — توضیحات / متن کمکی</p>
          <p className="text-xs text-ink-tertiary">text-xs — برچسب زمان / چیپ ثانویه</p>
          <p className="text-2xs text-ink-tertiary">text-2xs — میکرو برچسب / نشان</p>
        </div>
      </Section>

      <Section title="Colors — رنگ‌های معنایی">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Success', bg: 'bg-success-soft', text: 'text-success', border: 'border-success/20' },
            { name: 'Warning', bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/20' },
            { name: 'Danger', bg: 'bg-danger-soft', text: 'text-danger', border: 'border-danger/20' },
            { name: 'Info', bg: 'bg-info-soft', text: 'text-info', border: 'border-info/20' },
          ].map((c) => (
            <div key={c.name} className={`n-card p-3 border ${c.bg} ${c.border}`}>
              <span className={`text-sm font-semibold ${c.text}`}>{c.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons — دکمه‌ها">
        <Row label="Variants">
          <Button>پیش‌فرض</Button>
          <Button variant="secondary">ثانویه</Button>
          <Button variant="outline">حاشیه‌دار</Button>
          <Button variant="ghost">شبح</Button>
          <Button variant="destructive">حذف</Button>
        </Row>
        <Row label="Sizes">
          <Button size="lg">بزرگ</Button>
          <Button size="default">متوسط</Button>
          <Button size="sm">کوچک</Button>
        </Row>
        <Row label="States">
          <Button disabled>غیرفعال</Button>
          <Button className="min-h-[44px]">تاچ ۴۴px</Button>
        </Row>
      </Section>

      <Section title="Badges — نشان‌ها">
        <Row label="Variants">
          <Badge>پیش‌فرض</Badge>
          <Badge variant="secondary">ثانویه</Badge>
          <Badge variant="outline">حاشیه‌دار</Badge>
          <Badge variant="destructive">خطرناک</Badge>
        </Row>
        <Row label="Semantic">
          <span className="text-xs font-semibold text-success bg-success-soft border border-success/20 px-2 py-0.5 rounded-full">موفق</span>
          <span className="text-xs font-semibold text-warning bg-warning-soft border border-warning/20 px-2 py-0.5 rounded-full">در انتظار</span>
          <span className="text-xs font-semibold text-danger bg-danger-soft border border-danger/20 px-2 py-0.5 rounded-full">خطا</span>
          <span className="text-xs font-semibold text-info bg-info-soft border border-info/20 px-2 py-0.5 rounded-full">اطلاعات</span>
        </Row>
      </Section>

      <Section title="Form Controls — کنترل‌های فرم">
        <div className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label>ایمیل</Label>
            <Input type="email" placeholder="name@example.com" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label>متن پیام</Label>
            <Textarea placeholder="متن خود را وارد کنید…" rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="notif" />
            <Label htmlFor="notif">اعلان‌ها</Label>
          </div>
        </div>
      </Section>

      <Section title="Cards — کارت‌ها">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>کارت پیش‌فرض</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-ink-secondary">محتوای کارت با استایل پیش‌فرض نشرینو.</p></CardContent>
          </Card>
          <div className="n-card p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-2">n-card</h3>
            <p className="text-sm text-ink-secondary">کارت با کلاس n-card و گرادیان شیشه‌ای.</p>
          </div>
          <div className="n-card n-gradient-border p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-2">n-card + n-gradient-border</h3>
            <p className="text-sm text-ink-secondary">کارت با حاشیه گرادیانی.</p>
          </div>
          <div className="n-card-compact p-3">
            <h3 className="text-sm font-semibold text-ink-primary mb-1">n-card-compact</h3>
            <p className="text-xs text-ink-secondary">برای ردیف‌های جدول و لیست.</p>
          </div>
        </div>
      </Section>

      <Section title="Feedback — بازخورد">
        <div className="space-y-3">
          <Alert>
            <Info className="size-4" />
            <AlertTitle>اطلاعات</AlertTitle>
            <AlertDescription>یک پیام اطلاعاتی برای کاربر.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>خطایی رخ داده است.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Skeleton — بارگذاری">
        <div className="space-y-2 max-w-md">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </Section>

      <Section title="Progress — پیشرفت">
        <div className="space-y-3 max-w-md">
          <Progress value={33} />
          <Progress value={66} />
          <Progress value={100} />
        </div>
      </Section>

      <Section title="Avatar — آواتار">
        <Row label="Sizes">
          <Avatar className="size-6"><AvatarFallback>م</AvatarFallback></Avatar>
          <Avatar className="size-8"><AvatarFallback>ع</AvatarFallback></Avatar>
          <Avatar className="size-10"><AvatarFallback>ر</AvatarFallback></Avatar>
          <Avatar className="size-12"><AvatarFallback>ن</AvatarFallback></Avatar>
        </Row>
      </Section>

      <Separator />
      <p className="text-xs text-ink-tertiary text-center">
        Nashrino Component Workbench — فقط در محیط توسعه
      </p>
    </div>
  )
}
