export const metadata = {
  title: 'سیاست حریم خصوصی — نشرینو',
  description: 'Privacy Policy for Nashrino social media management platform',
}

export default function PrivacyPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">سیاست حریم خصوصی</h1>
        <p className="text-sm text-muted-foreground mb-10">Privacy Policy — Nashrino</p>

        <section className="space-y-8 text-base leading-relaxed">

          <div>
            <h2 className="text-lg font-semibold mb-2">۱. معرفی</h2>
            <p>
              نشرینو (Nashrino) یک پلتفرم مدیریت رسانه‌های اجتماعی است که به کاربران امکان می‌دهد محتوا را برنامه‌ریزی و منتشر کنند. این سیاست توضیح می‌دهد که چه اطلاعاتی جمع‌آوری می‌شود، چگونه استفاده می‌شود و چطور محافظت می‌شود.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۲. اطلاعات جمع‌آوری‌شده</h2>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>اطلاعات حساب کاربری (ایمیل، نام)</li>
              <li>توکن‌های دسترسی به شبکه‌های اجتماعی (Instagram و سایر پلتفرم‌ها)</li>
              <li>محتوای زمان‌بندی‌شده برای انتشار (متن، تصویر، ویدیو)</li>
              <li>داده‌های تحلیلی و آماری حساب‌های متصل</li>
              <li>پیام‌های دریافتی از طریق Webhookهای شبکه‌های اجتماعی</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۳. نحوه استفاده از اطلاعات</h2>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>انتشار خودکار محتوا در زمان‌های تعیین‌شده توسط کاربر</li>
              <li>نمایش تحلیل عملکرد محتوا در داشبورد</li>
              <li>دریافت و مدیریت پیام‌ها و کامنت‌های شبکه‌های اجتماعی</li>
              <li>بهبود کیفیت سرویس</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۴. مجوزهای Instagram</h2>
            <p className="mb-2">نشرینو از API اینستاگرام با مجوزهای زیر استفاده می‌کند:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><code>instagram_business_basic</code> — اطلاعات پایه حساب</li>
              <li><code>instagram_business_content_publish</code> — انتشار محتوا</li>
              <li><code>instagram_business_manage_comments</code> — مدیریت کامنت‌ها</li>
              <li><code>instagram_business_manage_messages</code> — مدیریت پیام‌های مستقیم</li>
              <li><code>instagram_business_manage_insights</code> — دسترسی به آمار</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۵. اشتراک‌گذاری اطلاعات</h2>
            <p>
              اطلاعات شما با اشخاص ثالث به اشتراک گذاشته نمی‌شود، مگر در موارد ضروری برای ارائه سرویس (مثل ارسال محتوا به API اینستاگرام) یا در صورت الزام قانونی.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۶. امنیت داده‌ها</h2>
            <p>
              توکن‌های دسترسی به صورت رمزگذاری‌شده ذخیره می‌شوند. تمام ارتباطات از طریق HTTPS انجام می‌شود. دسترسی به داده‌ها محدود به کارکنان مجاز است.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۷. حقوق کاربر</h2>
            <p>کاربران می‌توانند در هر زمان:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>اتصال حساب اینستاگرام خود را قطع کنند</li>
              <li>درخواست حذف داده‌های خود را بدهند</li>
              <li>به داده‌های ذخیره‌شده خود دسترسی داشته باشند</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">۸. تماس با ما</h2>
            <p>
              برای هرگونه سوال درباره حریم خصوصی با ما تماس بگیرید:
              <br />
              <a href="mailto:privacy@nashrino.ir" className="text-primary underline">privacy@nashrino.ir</a>
            </p>
          </div>

          <div className="pt-4 border-t border-border text-sm text-muted-foreground">
            <p>آخرین به‌روزرسانی: تیر ۱۴۰۵ | Last updated: July 2026</p>
          </div>

        </section>
      </div>
    </div>
  )
}
