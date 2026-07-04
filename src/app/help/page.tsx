/**
 * /help — Persian help center.
 *
 * Static content page; no authentication required.
 * Covers provider requirements, common troubleshooting, and platform limitations.
 */

import { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronLeft,
  Link2,
  AlertTriangle,
  Users,
  BarChart3,
  Lock,
  Send,
  ImageIcon,
  Calendar,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'مرکز راهنما — نشرینو',
  description: 'راهنمای استفاده از نشرینو: اتصال کانال‌ها، انتشار محتوا، و رفع مشکلات رایج',
}

interface Article {
  id: string
  title: string
  summary: string
  icon: React.ElementType
  content: string[]
}

const ARTICLES: Article[] = [
  {
    id: 'connect-instagram',
    title: 'چگونه کانال اینستاگرام متصل کنم؟',
    summary: 'راهنمای گام‌به‌گام اتصال حساب اینستاگرام Business یا Creator',
    icon: Link2,
    content: [
      'برای اتصال اینستاگرام، حساب شما باید از نوع Business یا Creator باشد. حساب‌های Personal پشتیبانی نمی‌شوند.',
      'مراحل اتصال: ۱. به بخش «پلتفرم‌ها و اتصال‌ها» بروید. ۲. روی «اتصال کانال جدید» کلیک کنید. ۳. اینستاگرام را انتخاب کنید. ۴. با حساب فیسبوک مرتبط با پیجتان وارد شوید.',
      'مجوزهای مورد نیاز: instagram_basic، instagram_content_publish، pages_show_list. اگر این مجوزها نمایش داده نشوند، تنظیمات Facebook Business شما ممکن است نیاز به بازبینی داشته باشد.',
      'اگر پیام «مجوز رد شد» مشاهده کردید: مطمئن شوید حساب فیسبوک شما Admin پیج اینستاگرام است.',
    ],
  },
  {
    id: 'publish-failed',
    title: 'چرا انتشار پست ناموفق بود؟',
    summary: 'دلایل رایج شکست در انتشار و نحوه رفع آن‌ها',
    icon: AlertTriangle,
    content: [
      'رایج‌ترین دلایل شکست در انتشار: ۱. توکن دسترسی منقضی شده — کانال را مجدداً متصل کنید. ۲. فرمت رسانه نامعتبر — اینستاگرام تنها JPG/PNG/MP4 می‌پذیرد. ۳. محدودیت کاراکتر — تعداد کاراکترهای مجاز را بررسی کنید.',
      'برای مشاهده جزئیات خطا: به بخش «تقویم محتوا» بروید، روی پست قرمزرنگ کلیک کنید، و پیام خطا را مشاهده کنید.',
      'راه‌حل سریع: اگر خطای «رمز منقضی شده» دریافت کردید، به «پلتفرم‌ها و اتصال‌ها» بروید و کانال مربوطه را دوباره متصل کنید.',
      'اگر پست چند بار متوالی شکست خورد: سیستم به‌صورت خودکار ۳ بار تلاش می‌کند. پس از آن پست در وضعیت «نیاز به اقدام» قرار می‌گیرد.',
    ],
  },
  {
    id: 'invite-member',
    title: 'چگونه عضو تیم دعوت کنم؟',
    summary: 'دعوت اعضای جدید، مدیریت نقش‌ها، و تنظیم دسترسی‌ها',
    icon: Users,
    content: [
      'برای دعوت عضو: به «تنظیمات» → «تیم» بروید و روی «دعوت عضو» کلیک کنید. ایمیل عضو جدید را وارد کنید و نقش مناسب را انتخاب کنید.',
      'نقش‌های موجود: مدیر (Admin) — دسترسی کامل. ویرایشگر (Editor) — ایجاد و ویرایش محتوا. تأییدکننده (Approver) — تأیید یا رد محتوا. بیننده (Viewer) — فقط مشاهده.',
      'لینک دعوت به ایمیل عضو ارسال می‌شود و تا ۷۲ ساعت معتبر است. اگر لینک منقضی شد، می‌توانید از همان صفحه دعوت جدید ارسال کنید.',
      'برای تغییر نقش عضو موجود: در صفحه «تیم»، روی نقش عضو کلیک کنید و نقش جدید را انتخاب کنید.',
    ],
  },
  {
    id: 'platform-limits',
    title: 'محدودیت‌های هر شبکه اجتماعی',
    summary: 'جدول محدودیت کاراکتر، رسانه، و فرکانس انتشار برای هر پلتفرم',
    icon: BarChart3,
    content: [
      'اینستاگرام: کپشن تا ۲۲۰۰ کاراکتر — تصویر حداکثر ۸MB (JPG/PNG) — ویدیو حداکثر ۴GB (MP4) — حداکثر ۲۵ هشتگ.',
      'لینکدین: کپشن تا ۳۰۰۰ کاراکتر (سازمانی) / ۱۳۰۰ (شخصی) — تصویر تا ۵MB — ویدیو تا ۵GB.',
      'تلگرام: پیام تا ۴۰۹۶ کاراکتر — هر نوع فایل تا ۵۰MB — ارسال نامحدود.',
      'بله / روبیکا / ایتا: پیام‌رسان‌های ایرانی معمولاً محدودیت مشابه تلگرام دارند.',
      'برای جلوگیری از خطای «محدودیت نرخ»: پیش از انتشار، فاصله ۱۰ دقیقه‌ای بین پست‌های متوالی رعایت کنید.',
    ],
  },
  {
    id: 'two-factor',
    title: 'احراز هویت دو مرحله‌ای (MFA)',
    summary: 'فعال‌سازی TOTP برای حساب‌های مدیر',
    icon: Lock,
    content: [
      'برای فعال‌سازی MFA: به «تنظیمات» → «حساب» بروید و روی «فعال‌سازی احراز دو مرحله‌ای» کلیک کنید.',
      'نشرینو از استاندارد TOTP پشتیبانی می‌کند. می‌توانید از Google Authenticator، Authy، یا هر اپلیکیشن مشابهی استفاده کنید.',
      'پس از فعال‌سازی، ۱۰ کد پشتیبان به شما داده می‌شود. آن‌ها را در مکانی امن نگه دارید — اگر دستگاه خود را گم کنید، تنها راه بازیابی دسترسی هستند.',
      'اگر به کدهای پشتیبان دسترسی ندارید: با ایمیل support@nashrino.com تماس بگیرید. تیم پشتیبانی پس از تأیید هویت، دسترسی را بازیابی می‌کند.',
    ],
  },
  {
    id: 'publish-queue',
    title: 'صف انتشار و زمان‌بندی پست‌ها',
    summary: 'تفاوت انتشار فوری، زمان‌بندی، و صف انتشار',
    icon: Send,
    content: [
      'انتشار فوری (اکنون): پست بلافاصله به صف پردازش اضافه می‌شود و معمولاً ظرف ۳۰ ثانیه منتشر می‌شود.',
      'زمان‌بندی: می‌توانید تاریخ و ساعت دقیق انتشار را تعیین کنید. نشرینو از منطقه زمانی تنظیم‌شده در فضای کار شما استفاده می‌کند.',
      'صف انتشار: پست به صف فضای کار اضافه می‌شود و در بهترین زمان ممکن بر اساس الگوی مخاطبان منتشر می‌شود.',
      'برای ویرایش یا حذف پست برنامه‌ریزی‌شده: در «تقویم محتوا» روی پست کلیک کنید و «ویرایش» یا «حذف» را انتخاب کنید. این امکان تا ۵ دقیقه پیش از زمان انتشار وجود دارد.',
    ],
  },
  {
    id: 'media-storage',
    title: 'مدیریت رسانه و فضای ذخیره‌سازی',
    summary: 'آپلود تصویر و ویدیو، سازمان‌دهی کتابخانه رسانه',
    icon: ImageIcon,
    content: [
      'فرمت‌های پشتیبانی‌شده: JPG، PNG، GIF، WebP برای تصویر — MP4، MOV، AVI برای ویدیو. حداکثر حجم فایل: ۵۰MB.',
      'برای آپلود: در بخش «رسانه» روی «آپلود رسانه» کلیک کنید یا فایل را مستقیماً به صفحه بکشید.',
      'رسانه‌های آپلودشده در کتابخانه نگهداری می‌شوند و در تمام پست‌ها قابل استفاده مجدد هستند.',
      'در صورت مشاهده خطای «حجم فایل زیاد»: فایل را با ابزاری مانند Handbrake (ویدیو) یا TinyPNG (تصویر) فشرده کنید.',
    ],
  },
  {
    id: 'jalali-calendar',
    title: 'استفاده از تقویم شمسی',
    summary: 'نمایش تاریخ‌های شمسی و هماهنگی با تقویم میلادی',
    icon: Calendar,
    content: [
      'نشرینو تمام تاریخ‌ها را به صورت شمسی (جلالی) نمایش می‌دهد. تقویم میلادی در پس‌زمینه استفاده می‌شود.',
      'برای تنظیم منطقه زمانی: به «تنظیمات» → «پروفایل فضای کار» بروید و «منطقه زمانی» را تغییر دهید. پیشنهاد: Asia/Tehran برای ایران.',
      'هنگام برنامه‌ریزی پست برای مخاطبان ایرانی: بهترین زمان‌ها معمولاً ساعت ۱۲-۱۳ و ۲۰-۲۲ به وقت تهران هستند.',
    ],
  },
  {
    id: 'analytics',
    title: 'تحلیل آمار و گزارش‌ها',
    summary: 'درک داده‌های آماری و استفاده از گزارش‌های نشرینو',
    icon: BarChart3,
    content: [
      'بخش «تحلیل و گزارش‌ها» داده‌های ۷ و ۳۰ روزه را نشان می‌دهد. داده‌ها از APIهای رسمی شبکه‌های اجتماعی گرفته می‌شوند و ممکن است تا ۲۴ ساعت تأخیر داشته باشند.',
      'برای صادرکردن گزارش: در صفحه «تحلیل»، روی «صادرکردن» کلیک کنید و قالب دلخواه (CSV یا PDF) را انتخاب کنید.',
      'اگر داده‌ای نمایش داده نمی‌شود: ممکن است کانال شما به تازگی متصل شده باشد. داده‌ها پس از اولین انتشار موفق در سیستم ثبت می‌شوند.',
    ],
  },
  {
    id: 'connection-issues',
    title: 'رفع مشکلات اتصال به API',
    summary: 'خطاهای متداول API و راه‌حل‌های آن‌ها',
    icon: AlertTriangle,
    content: [
      'خطای «توکن منقضی»: به «پلتفرم‌ها» بروید و کانال را دوباره متصل کنید. توکن‌های اینستاگرام و لینکدین هر ۶۰ روز منقضی می‌شوند.',
      'خطای «دسترسی رد شد» (403): مجوزهای OAuth کانال را بررسی کنید. ممکن است مجوز جدیدی برای ویژگی‌های اخیر نیاز باشد.',
      'خطای «محدودیت نرخ» (429): تعداد درخواست‌ها به API از حد مجاز گذشته. نشرینو به‌صورت خودکار تلاش مجدد می‌کند. اگر مشکل ادامه یافت، چند ساعت صبر کنید.',
      'خطای «سرویس در دسترس نیست» (503): ممکن است API پلتفرم موقتاً قطع باشد. وضعیت سرویس‌های نشرینو را در صفحه /status بررسی کنید.',
    ],
  },
]

export default function HelpPage() {
  return (
    <div dir="rtl" className="h-dvh overflow-y-auto thin-scrollbar bg-canvas px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-ink-tertiary hover:text-ink-primary transition-colors text-sm mb-6"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-accent">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="font-semibold">نشرینو</span>
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft">
              <HelpCircle className="size-5 text-accent" />
            </div>
            <h1 className="text-xl font-bold text-ink-primary">مرکز راهنما</h1>
          </div>
          <p className="text-base text-ink-secondary">
            پاسخ سوالات رایج، راهنمای اتصال کانال‌ها، و رفع مشکلات متداول
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {[
            { href: '#connect-instagram', label: 'اتصال اینستاگرام' },
            { href: '#publish-failed', label: 'خطای انتشار' },
            { href: '#platform-limits', label: 'محدودیت‌های پلتفرم' },
            { href: '#two-factor', label: 'احراز هویت MFA' },
            { href: '#connection-issues', label: 'مشکلات API' },
            { href: 'mailto:support@nashrino.com', label: 'تماس با پشتیبانی' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink-primary transition-colors"
            >
              {link.label}
              <ChevronLeft className="size-4 text-ink-tertiary" />
            </a>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-6">
          {ARTICLES.map((article) => {
            const Icon = article.icon
            return (
              <div
                key={article.id}
                id={article.id}
                className="rounded-2xl border border-border bg-surface-raised overflow-hidden"
              >
                <div className="flex items-start gap-4 p-5 border-b border-border/60">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                    <Icon className="size-4.5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-primary leading-tight">
                      {article.title}
                    </h2>
                    <p className="text-sm text-ink-tertiary mt-0.5">{article.summary}</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {article.content.map((para, i) => (
                    <p key={i} className="text-sm text-ink-secondary leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-border">
          <p className="text-sm text-ink-tertiary mb-4">
            سوالی پیدا نکردید؟ تیم پشتیبانی ما آماده کمک است.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:support@nashrino.com"
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              <ExternalLink className="size-4" />
              تماس با پشتیبانی
            </a>
            <Link
              href="/status"
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
            >
              وضعیت سرویس
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
