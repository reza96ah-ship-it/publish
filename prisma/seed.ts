import { db } from '../src/lib/db'

const WORKSPACE_SLUG = 'nashrino-demo'

// Jalali "today" helpers — we store dates as ISO but render Jalali in UI.
const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3600_000)
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000)

async function main() {
  // Clean
  await db.notification.deleteMany()
  await db.analyticsSnapshot.deleteMany()
  await db.inboxMessage.deleteMany()
  await db.media.deleteMany()
  await db.publishJob.deleteMany()
  await db.publication.deleteMany()
  await db.contentRevision.deleteMany()
  await db.contentPlatform.deleteMany()
  await db.content.deleteMany()
  await db.workspaceInvitation.deleteMany()
  await db.campaign.deleteMany()
  await db.platform.deleteMany()
  await db.workspaceMember.deleteMany()
  await db.workspace.deleteMany()
  await db.user.deleteMany({
    where: {
      id: { in: ['u1', 'u2', 'u3', 'u4', 'u5'] },
    },
  })

  // ─── Workspace ───
  const ws = await db.workspace.create({
    data: {
      name: 'نشرینو',
      slug: WORKSPACE_SLUG,
      category: 'فناوری و رسانه',
      phone: '۰۲۱-۹۱۰۰۰۰۰۰',
      description:
        'استودیوی عملیات شبکه‌های اجتماعی نشرینو — برنامه‌ریزی، تولید، انتشار و تحلیل محتوا در یک پلتفرم.',
      timezone: 'Asia/Tehran',
      plan: 'agency',
      brandPrimaryColor: '#0F766E',
      brandAccentColor: '#4757CD',
      brandVoice: 'دوستانه، حرفه‌ای، مختصر',
      defaultCta: 'همین حالا ثبت‌نام کنید',
      contentGuidelines: 'از لحن رسمی پرهیز کنید. همیشه با سلام شروع کنید.',
      defaultHashtags: '#نشرینو #بازاریابی_دیجیتال',
      captionFooter: '— تیم نشرینو',
      persianDigits: true,
    },
  })

  // ─── Members ───
  await db.$transaction([
    db.user.create({ data: { id: 'u1', email: 'ali@nashrino.ir', name: 'علی احمدی' } }),
    db.user.create({ data: { id: 'u2', email: 'sara@nashrino.ir', name: 'سارا مرادی' } }),
    db.user.create({ data: { id: 'u3', email: 'mohammad@nashrino.ir', name: 'محمد رضایی' } }),
    db.user.create({ data: { id: 'u4', email: 'farnaz@nashrino.ir', name: 'فرناز اسدی' } }),
    db.user.create({ data: { id: 'u5', email: 'hossein@nashrino.ir', name: 'حسین کریمی' } }),
  ])

  const members = await db.$transaction([
    db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: 'u1',
        name: 'علی احمدی',
        email: 'ali@nashrino.ir',
        role: 'admin',
        avatarUrl: 'https://i.pravatar.cc/150?u=1',
      },
    }),
    db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: 'u2',
        name: 'سارا مرادی',
        email: 'sara@nashrino.ir',
        role: 'editor',
        avatarUrl: 'https://i.pravatar.cc/150?u=2',
      },
    }),
    db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: 'u3',
        name: 'محمد رضایی',
        email: 'mohammad@nashrino.ir',
        role: 'approver',
        avatarUrl: 'https://i.pravatar.cc/150?u=3',
      },
    }),
    db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: 'u4',
        name: 'فرناز اسدی',
        email: 'farnaz@nashrino.ir',
        role: 'editor',
        avatarUrl: 'https://i.pravatar.cc/150?u=4',
      },
    }),
    db.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId: 'u5',
        name: 'حسین کریمی',
        email: 'hossein@nashrino.ir',
        role: 'viewer',
        avatarUrl: 'https://i.pravatar.cc/150?u=5',
      },
    }),
  ])

  // ─── Platforms ───
  const platforms = await db.$transaction([
    db.platform.create({
      data: {
        workspaceId: ws.id,
        type: 'instagram',
        name: 'اینستاگرام',
        username: 'nashrino_official',
        accountKind: 'professional',
        status: 'active',
        lastSuccessAt: hoursAgo(2),
      },
    }),
    db.platform.create({
      data: {
        workspaceId: ws.id,
        type: 'instagram',
        name: 'اینستاگرام آکادمی',
        username: 'nashrino_academy',
        accountKind: 'professional',
        status: 'expired',
        lastSuccessAt: hoursAgo(48),
        lastError: 'انقضای توکن حساب اصلی',
        primaryIssue: 'انقضای توکن حساب اصلی',
      },
    }),
    db.platform.create({
      data: {
        workspaceId: ws.id,
        type: 'telegram',
        name: 'تلگرام',
        username: 'nashrino_channel',
        accountKind: 'channel',
        status: 'active',
        lastSuccessAt: hoursAgo(0),
      },
    }),
    db.platform.create({
      data: {
        workspaceId: ws.id,
        type: 'linkedin',
        name: 'لینکدین',
        username: 'Nashrino Co.',
        accountKind: 'professional',
        status: 'active',
        lastSuccessAt: hoursAgo(0.1),
      },
    }),
    db.platform.create({
      data: {
        workspaceId: ws.id,
        type: 'rubika',
        name: 'روبیکا',
        username: 'nashrino_shop',
        accountKind: 'channel',
        status: 'error',
        lastSuccessAt: hoursAgo(24),
        lastError: 'خطای سرور ۵۰۰',
        primaryIssue: 'اختلال API',
        circuitState: 'open',
      },
    }),
  ])
  const [ig, igAcademy, tg, li, rubika] = platforms

  // ─── Campaigns ───
  const campaigns = await db.$transaction([
    db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: 'تخفیف‌های تابستانه',
        description: 'کمپین فروش فصل گرما با تخفیف ویژه',
        status: 'active',
        startDate: daysAgo(10),
        endDate: hoursAhead(12 * 24),
        goalType: 'reach',
        goalValue: 250000,
        healthLabel: 'در مسیر برنامه، با پیشرفت منظم انتشارها',
        healthColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        ownerName: 'علی احمدی',
        pubProgress: 60,
        goalCompletion: '۲۵۰k بازدید',
        daysRemaining: '۱۲ روز باقی‌مانده',
        topBlocker: null,
      },
    }),
    db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: 'معرفی ویژگی‌های نشرینو',
        description: 'معرفی قابلیت‌های جدید پلتفرم',
        status: 'active',
        startDate: daysAgo(5),
        endDate: hoursAhead(3 * 24),
        goalType: 'reach',
        goalValue: 50000,
        healthLabel: 'نیازمند توجه، به دلیل تأخیر در محتوای ویدیویی',
        healthColor: 'text-amber-700 bg-amber-50 border-amber-200',
        ownerName: 'سارا مرادی',
        pubProgress: 25,
        goalCompletion: '۵۰k دسترسی',
        daysRemaining: '۳ روز باقی‌مانده',
        topBlocker: 'تأخیر در طراحی بنر',
      },
    }),
    db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: 'مسابقه عکاسی',
        description: 'مسابقه عکاسی کاربران با جوایز',
        status: 'completed',
        startDate: daysAgo(30),
        endDate: daysAgo(2),
        goalType: 'engagement',
        goalValue: 100000,
        healthLabel: 'در معرض ریسک، زیرا ۳ خروجی عقب افتاده است',
        healthColor: 'text-rose-700 bg-rose-50 border-rose-200',
        ownerName: 'محمد رضایی',
        pubProgress: 85,
        goalCompletion: '۱۰۰k مشارکت',
        daysRemaining: 'پایان یافته',
        topBlocker: 'تأییدیه بودجه',
      },
    }),
    db.campaign.create({
      data: {
        workspaceId: ws.id,
        name: 'آکادمی نشرینو',
        description: 'دوره‌های آموزشی بازاریابی دیجیتال',
        status: 'active',
        startDate: daysAgo(15),
        endDate: hoursAhead(30 * 24),
        goalType: 'conversion',
        goalValue: 5000,
        healthLabel: 'در مسیر برنامه',
        healthColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        ownerName: 'حسین کریمی',
        pubProgress: 40,
        goalCompletion: '۵۰۰۰ ثبت‌نام',
        daysRemaining: '۳۰ روز باقی‌مانده',
        topBlocker: null,
      },
    }),
  ])
  const [summerSale, featureIntro, photoContest, academy] = campaigns

  // ─── Media ───
  const _media = await db.$transaction([
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'بنر تخفیف تابستانه.jpg',
        fileType: 'image/jpeg',
        fileSize: 245678,
        url: 'https://picsum.photos/seed/summer/800/800',
        thumbnailUrl: 'https://picsum.photos/seed/summer/100/100',
        folder: 'کمپین تابستانه',
        width: 1080,
        height: 1080,
        tags: 'بنر,تخفیف,تابستان',
      },
    }),
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'محصول جدید.png',
        fileType: 'image/png',
        fileSize: 512000,
        url: 'https://picsum.photos/seed/product1/800/800',
        thumbnailUrl: 'https://picsum.photos/seed/product1/100/100',
        folder: 'محصولات',
        width: 1080,
        height: 1350,
        tags: 'محصول,معرفی',
      },
    }),
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'مقاله لینکدین.jpg',
        fileType: 'image/jpeg',
        fileSize: 180234,
        url: 'https://picsum.photos/seed/article2/800/450',
        thumbnailUrl: 'https://picsum.photos/seed/article2/100/100',
        folder: 'مقالات',
        width: 1200,
        height: 627,
        tags: 'مقاله,بازاریابی',
      },
    }),
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'ویدیوی معرفی.mp4',
        fileType: 'video/mp4',
        fileSize: 15400000,
        url: 'https://picsum.photos/seed/video3/800/450',
        thumbnailUrl: 'https://picsum.photos/seed/video3/100/100',
        folder: 'ویدیو',
        tags: 'ویدیو,معرفی',
      },
    }),
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'گزارش ماهانه.pdf',
        fileType: 'application/pdf',
        fileSize: 890000,
        url: 'https://picsum.photos/seed/report4/800/1000',
        thumbnailUrl: 'https://picsum.photos/seed/report4/100/100',
        folder: 'گزارشات',
        tags: 'گزارش,ماهانه',
      },
    }),
    db.media.create({
      data: {
        workspaceId: ws.id,
        name: 'پوستر وبینار.jpg',
        fileType: 'image/jpeg',
        fileSize: 320000,
        url: 'https://picsum.photos/seed/webinar5/800/800',
        thumbnailUrl: 'https://picsum.photos/seed/webinar5/100/100',
        folder: 'وبینار',
        width: 1080,
        height: 1080,
        tags: 'وبینار,آموزش',
      },
    }),
  ])

  // ─── Content + PublishJobs ───
  const mkContent = (data: Parameters<typeof db.content.create>[0]['data']) =>
    db.content.create({ data })
  const mkJob = (data: Parameters<typeof db.publishJob.create>[0]['data']) =>
    db.publishJob.create({ data })

  const c1 = await mkContent({
    workspaceId: ws.id,
    campaignId: summerSale.id,
    title: 'معرفی محصول جدید تابستانه',
    body: 'توی این پست درباره ویژگی‌های محصول جدید تابستانه صحبت می‌کنیم. با تخفیف ویژه تا پایان هفته!',
    hashtags: '#محصول_جدید #تخفیف #تابستان',
    status: 'published',
    authorName: 'علی احمدی',
    thumbnailUrl: 'https://picsum.photos/seed/product1/100/100',
    publishedAt: hoursAgo(20),
  })
  const c2 = await mkContent({
    workspaceId: ws.id,
    campaignId: featureIntro.id,
    title: 'نکات مهم بازاریابی دیجیتال',
    body: 'در این مقاله به بررسی جدیدترین روندهای بازاریابی دیجیتال می‌پردازیم.',
    hashtags: '#بازاریابی_دیجیتال #نشرینو',
    status: 'scheduled',
    authorName: 'سارا مرادی',
    thumbnailUrl: 'https://picsum.photos/seed/article2/100/100',
    scheduledAt: hoursAhead(2),
  })
  const c3 = await mkContent({
    workspaceId: ws.id,
    campaignId: summerSale.id,
    title: 'تخفیف ویژه آخر هفته',
    body: 'فرصت محدود! فقط تا پایان این هفته ۲۰٪ تخفیف روی همه محصولات.',
    hashtags: '#تخفیف #آخر_هفته',
    status: 'failed',
    authorName: 'محمد رضایی',
    thumbnailUrl: 'https://picsum.photos/seed/sale3/100/100',
  })
  const c4 = await mkContent({
    workspaceId: ws.id,
    campaignId: academy.id,
    title: 'گزارش عملکرد ماهانه',
    body: 'نگاهی به دستاوردهای تیم نشرینو در ماه گذشته.',
    hashtags: '#گزارش #عملکرد',
    status: 'published',
    authorName: 'فرناز اسدی',
    thumbnailUrl: 'https://picsum.photos/seed/report4/100/100',
    publishedAt: hoursAgo(28),
  })
  const c5 = await mkContent({
    workspaceId: ws.id,
    campaignId: academy.id,
    title: 'وبینار مدیریت شبکه‌های اجتماعی',
    body: 'ثبت‌نام وبینار رایگان مدیریت شبکه‌های اجتماعی آغاز شد.',
    hashtags: '#وبینار #آموزش #رایگان',
    status: 'scheduled',
    authorName: 'حسین کریمی',
    thumbnailUrl: 'https://picsum.photos/seed/webinar5/100/100',
    scheduledAt: hoursAhead(20),
  })
  const _c6 = await mkContent({
    workspaceId: ws.id,
    campaignId: photoContest.id,
    title: 'برندگان مسابقه عکاسی',
    body: 'با افتخار برندگان مسابقه عکاسی نشرینو را معرفی می‌کنیم.',
    hashtags: '#مسابقه #عکاسی #برنده',
    status: 'draft',
    authorName: 'علی احمدی',
    thumbnailUrl: 'https://picsum.photos/seed/photo6/100/100',
  })
  const _c7 = await mkContent({
    workspaceId: ws.id,
    campaignId: summerSale.id,
    title: 'پست داستان مشتری',
    body: 'تجربه یکی از مشتریان ما با محصولات نشرینو.',
    hashtags: '#مشتری #تجربه',
    status: 'review',
    authorName: 'سارا مرادی',
  })
  const _c8 = await mkContent({
    workspaceId: ws.id,
    title: 'محتوای همیشه سبز SEO',
    body: 'راهنمای کامل سئو برای کسب‌وکارهای کوچک.',
    hashtags: '#سئو #بازاریابی',
    status: 'approved',
    authorName: 'فرناز اسدی',
  })

  await db.$transaction([
    db.contentPlatform.create({ data: { contentId: c1.id, platformId: ig.id } }),
    db.contentPlatform.create({ data: { contentId: c1.id, platformId: tg.id } }),
    db.contentPlatform.create({ data: { contentId: c1.id, platformId: rubika.id } }),
    db.contentPlatform.create({ data: { contentId: c2.id, platformId: li.id } }),
    db.contentPlatform.create({ data: { contentId: c3.id, platformId: rubika.id } }),
    db.contentPlatform.create({ data: { contentId: c4.id, platformId: tg.id } }),
    db.contentPlatform.create({ data: { contentId: c4.id, platformId: li.id } }),
    db.contentPlatform.create({ data: { contentId: c5.id, platformId: ig.id } }),
    db.contentPlatform.create({ data: { contentId: c5.id, platformId: igAcademy.id } }),
  ])

  // Publish jobs
  await db.$transaction([
    mkJob({
      workspaceId: ws.id,
      contentId: c1.id,
      platformId: ig.id,
      campaignId: summerSale.id,
      assigneeId: members[0].id,
      status: 'processing',
      progress: 65,
      processLabel: 'پردازش در پلتفرم',
      scheduledAt: hoursAgo(0.2),
      startedAt: hoursAgo(0.2),
      thumbnailUrl: c1.thumbnailUrl,
      idempotencyKey: 'j1',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c1.id,
      platformId: tg.id,
      campaignId: summerSale.id,
      assigneeId: members[0].id,
      status: 'success',
      progress: 100,
      processLabel: 'تأیید شد',
      scheduledAt: hoursAgo(0.5),
      completedAt: hoursAgo(0.4),
      thumbnailUrl: c1.thumbnailUrl,
      idempotencyKey: 'j2',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c1.id,
      platformId: rubika.id,
      campaignId: summerSale.id,
      assigneeId: members[0].id,
      status: 'success',
      progress: 100,
      processLabel: 'تأیید شد',
      scheduledAt: hoursAgo(0.5),
      completedAt: hoursAgo(0.45),
      thumbnailUrl: c1.thumbnailUrl,
      idempotencyKey: 'j3',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c2.id,
      platformId: li.id,
      campaignId: featureIntro.id,
      assigneeId: members[1].id,
      status: 'processing',
      progress: 40,
      processLabel: 'بارگذاری رسانه',
      scheduledAt: hoursAhead(2),
      startedAt: hoursAgo(0.1),
      thumbnailUrl: c2.thumbnailUrl,
      idempotencyKey: 'j4',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c3.id,
      platformId: rubika.id,
      campaignId: summerSale.id,
      assigneeId: members[2].id,
      status: 'action',
      progress: 100,
      processLabel: 'خطا در اتصال',
      error: 'اختلال API روبیکا',
      scheduledAt: hoursAgo(0.2),
      thumbnailUrl: c3.thumbnailUrl,
      idempotencyKey: 'j5',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c4.id,
      platformId: tg.id,
      campaignId: academy.id,
      assigneeId: members[3].id,
      status: 'success',
      progress: 100,
      processLabel: 'تأیید شد',
      scheduledAt: hoursAgo(28),
      completedAt: hoursAgo(28),
      thumbnailUrl: c4.thumbnailUrl,
      idempotencyKey: 'j6',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c4.id,
      platformId: li.id,
      campaignId: academy.id,
      assigneeId: members[3].id,
      status: 'success',
      progress: 100,
      processLabel: 'تأیید شد',
      scheduledAt: hoursAgo(28),
      completedAt: hoursAgo(28),
      thumbnailUrl: c4.thumbnailUrl,
      idempotencyKey: 'j7',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c5.id,
      platformId: ig.id,
      campaignId: academy.id,
      assigneeId: members[4].id,
      status: 'scheduled',
      progress: 0,
      processLabel: 'در انتظار سرور',
      scheduledAt: hoursAhead(20),
      thumbnailUrl: c5.thumbnailUrl,
      idempotencyKey: 'j8',
    }),
    mkJob({
      workspaceId: ws.id,
      contentId: c5.id,
      platformId: igAcademy.id,
      campaignId: academy.id,
      assigneeId: members[4].id,
      status: 'scheduled',
      progress: 0,
      processLabel: 'در انتظار سرور',
      scheduledAt: hoursAhead(20),
      thumbnailUrl: c5.thumbnailUrl,
      idempotencyKey: 'j9',
    }),
  ])

  // ─── Inbox ───
  await db.$transaction([
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: ig.id,
        senderName: 'مریم حسینی',
        senderAvatar: 'https://i.pravatar.cc/150?u=m1',
        message: 'سلام، قیمت دوره آموزشی رو می‌خواستم بدونم 🙏',
        isRead: false,
        platformType: 'instagram',
        messageType: 'comment',
        createdAt: hoursAgo(0.5),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: ig.id,
        senderName: 'رضا کاظمی',
        senderAvatar: 'https://i.pravatar.cc/150?u=m2',
        message: 'کد تخفیف برای خرید عمده دارید؟',
        isRead: false,
        platformType: 'instagram',
        messageType: 'dm',
        createdAt: hoursAgo(1.5),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: tg.id,
        senderName: 'آرش محمدی',
        senderAvatar: 'https://i.pravatar.cc/150?u=m3',
        message: 'لینک ثبت‌نام وبینار کجاست؟',
        isRead: false,
        platformType: 'telegram',
        messageType: 'comment',
        createdAt: hoursAgo(3),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: ig.id,
        senderName: 'نگار اکبری',
        senderAvatar: 'https://i.pravatar.cc/150?u=m4',
        message: 'عالی بود محتوای آخر 👏',
        isRead: true,
        isReplied: true,
        reply: 'ممنون از لطف شما!',
        platformType: 'instagram',
        messageType: 'comment',
        createdAt: hoursAgo(8),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: li.id,
        senderName: 'پویا رحیمی',
        senderAvatar: 'https://i.pravatar.cc/150?u=m5',
        message: 'Interested in your services. Can we schedule a call?',
        isRead: false,
        platformType: 'linkedin',
        messageType: 'dm',
        createdAt: hoursAgo(12),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: ig.id,
        senderName: 'سحر نوری',
        senderAvatar: 'https://i.pravatar.cc/150?u=m6',
        message: 'آدرس فروشگاه فیزیکی؟',
        isRead: true,
        platformType: 'instagram',
        messageType: 'comment',
        createdAt: hoursAgo(20),
      },
    }),
    db.inboxMessage.create({
      data: {
        workspaceId: ws.id,
        platformId: rubika.id,
        senderName: 'کیان فتحی',
        senderAvatar: 'https://i.pravatar.cc/150?u=m7',
        message: 'سفارش من کی ارسال میشه؟',
        isRead: false,
        platformType: 'rubika',
        messageType: 'dm',
        createdAt: hoursAgo(2),
      },
    }),
  ])

  // ─── Analytics snapshots (last 7 days) ───
  const metricTypes = ['reach', 'engagement', 'followers', 'clicks']
  const platformsForAn = ['instagram', 'telegram', 'linkedin', 'rubika', null]
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now.getTime() - d * 86400_000).toISOString().slice(0, 10)
    for (const m of metricTypes) {
      for (const p of platformsForAn) {
        const base =
          m === 'reach' ? 320000 : m === 'engagement' ? 18000 : m === 'followers' ? 1780 : 4200
        const noise = Math.floor((Math.random() - 0.3) * base * 0.15)
        await db.analyticsSnapshot.create({
          data: {
            workspaceId: ws.id,
            date,
            platform: p,
            metricType: m,
            value: Math.max(0, base + noise + (6 - d) * (base * 0.02)),
          },
        })
      }
    }
  }

  // ─── Notifications ───
  await db.$transaction([
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'publish_failed',
        title: '۲ انتشار اینستاگرام ناموفق است',
        body: 'کمپین معرفی محصول تحت تأثیر قرار گرفته',
        isRead: false,
        createdAt: hoursAgo(0.13),
      },
    }),
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'approval_requested',
        title: '۳ پست در انتظار تأیید',
        isRead: false,
        createdAt: hoursAgo(1),
      },
    }),
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'token_expiring',
        title: 'مجوز LinkedIn تا دو روز دیگر منقضی می‌شود',
        isRead: false,
        createdAt: hoursAgo(4),
      },
    }),
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'inbox_new',
        title: '۵ پیام نزدیک به نقض زمان پاسخ',
        isRead: false,
        createdAt: hoursAgo(5),
      },
    }),
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'channel_disconnected',
        title: 'اتصال Rubika قطع است',
        body: 'خطای سرور ۵۰۰',
        isRead: false,
        createdAt: hoursAgo(6),
      },
    }),
    db.notification.create({
      data: {
        workspaceId: ws.id,
        type: 'publish_success',
        title: 'انتشار تلگرام با موفقیت انجام شد',
        isRead: true,
        createdAt: hoursAgo(28),
      },
    }),
  ])

  console.log('✅ Seed complete — workspace:', ws.slug)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
