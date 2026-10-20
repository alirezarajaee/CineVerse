# CineVerse 🎬

**دنیای فیلم و سریال در دستان شما**
`Built by Alireza Rajaee`

[🇬🇧 English](README.md)

CineVerse یک اپلیکیشن کشف و تماشای فیلم، سریال و انیمیشن با رابط **کاملاً فارسی و RTL** است:
وب‌اپ موبایل‌محور روی Next.js 16 + **اپ اندروید (APK)** نصب‌شدنی که همین محصول را در WebView بومی تمام‌صفحه اجرا می‌کند.

- 🗄️ **متادیتای زنده و کامل:** اتصال به Cinemeta (پایگاه داده IMDb/Stremio) — بدون کلید API؛ جستجوی میلیون‌ها فیلم و سریال با پوستر، امتیاز، خلاصه، ژانر، بازیگران و فصل/قسمت واقعی
- ▶️ **پخش برای هر جستجو:** ۶ سرور پخش قابل تعویض + پخش فایل مستقیم (MP4/HLS با hls.js)
- ⬇️ **دانلود مستقیم:** رزولور دانلود Archive.org برای عنوان‌های آزاد + دانلودر بومی در APK
- 📝 **زیرنویس فارسی:** موتور رندر RTL اختصاصی (VTT/SRT) + دریافت زیرنویس از OpenSubtitles
- 🔑 **ورود بدون هیچ تنظیماتی:** حساب ایمیل/نام‌کاربری + رمز (bcrypt) + مهمان واقعی با انتقال کتابخانه
- 💾 کتابخانه شخصی: علاقه‌مندی، لیست تماشا، ادامه تماشا، تاریخچه — پایدار در SQLite

---

## دریافت فایل‌ها

| فایل | مسیر |
|---|---|
| 📱 APK اندروید | `/downloads/CineVerse.apk` |
| 🗜️ سورس کامل پروژه | `/downloads/cineverse-source.zip` |

هر دو لینک داخل اپ هم هستند: **پروفایل ← «دریافت فایل‌ها»**.

### نصب APK روی گوشی
1. فایل `/downloads/CineVerse.apk` را دانلود کنید (از لینک بالا یا دکمه داخل اپ در پروفایل).
2. به گوشی منتقل و نصب کنید («نصب از منابع ناشناس» را برای مرورگر/فایل‌منیجر خودتان فعال کنید — APK با امضای debug توسعه است).
3. در اجرای اول، اپ **آدرس سرور** را می‌پرسد: همان نشانی‌ای که CineVerse را با آن در مرورگر باز می‌کنید (لینک Preview) را وارد کنید.
4. اپ تمام‌صفحه با آیکون اختصاصی CineVerse اجرا می‌شود؛ دانلود فایل‌ها از داخل اپ با DownloadManager بومی انجام می‌شود.
5. تغییر آدرس سرور بعداً: پروفایل ← «اتصال اپ اندروید» ← تغییر آدرس سرور.

> ⚠️ APK یک Wrapper بومی (WebView) روی همین محصول وب است؛ برای کارکرد، سرور CineVerse باید در دسترس باشد. نشانی سرور در گوشی ذخیره می‌شود و هر وقت سرور عوض شد از داخل اپ قابل تغییر است.

## اجرا از سورس (توسعه)

```bash
bun install
bun run db:push        # ساخت اسکیمای SQLite
bun run dev            # اجرا روی پورت 3000
```

قبل از اجرا `.env` بسازید (الگو: `.env.example`):

```
DATABASE_URL=file:./db/custom.db
AUTH_SECRET=<یک رشته تصادفی ۶۴ حرفی>
```

پیش‌نمایش را از پنل Preview باز کنید (نه localhost مستقیم).

## معماری

```
src/
├─ app/
│  ├─ page.tsx                 # تنها مسیر UI — اپ به‌صورت SPA داخلی رندر می‌شود
│  ├─ layout.tsx               # RTL، lang=fa، فونت Vazirmatn، PWA manifest
│  ├─ globals.css              # Design System (پالت سینمایی، اسکرول‌بار، گرادیان‌ها)
│  └─ api/                     # Route Handlerها
│     ├─ auth/{register,login,guest,session,logout,google,google/callback}
│     ├─ account/delete
│     ├─ home, search, catalog, metadata/detail
│     ├─ sources, subtitles    # سرورهای پخش + زیرنویس فارسی
│     ├─ library/{favorites,watchlist,history}
│     └─ search-history, settings
├─ components/cineverse/
│  ├─ App.tsx                  # ریشه: Splash→Welcome→Tabs + Stack + WatchScreen overlay
│  ├─ PhoneShell.tsx           # فریم موبایل روی دسکتاپ / تمام‌صفحه روی موبایل
│  ├─ screens/                 # Splash, Welcome, Home, Search, Catalog, Detail,
│  │                           # Library, History/Continue, Profile, Settings, About
│  └─ player/WatchScreen.tsx   # مود embed (۶ سرور) + مود file (hls.js + زیرنویس RTL)
├─ lib/
│  ├─ providers/metadata.ts    # آداپتور Cinemeta (کش ۱۰ دقیقه + retry دو میزبان)
│  ├─ providers/sources.ts     # آداپتور ۶ سرور پخش
│  ├─ providers/subtitles.ts   # آداپتور OpenSubtitles + پروکسی same-origin
│  ├─ download.ts              # رزولور دانلود مستقیم (Archive.org)
│  ├─ session.ts               # کوکی امضاشده HMAC + مهمان واقعی + ارتقای درجا
│  ├─ api.ts                   # کلاینت typed با پیام خطای فارسی
│  ├─ store.ts                 # Zustand (ناوبری Stack، Player، Session)
│  ├─ subtitles.ts             # پارسر VTT/SRT + موتور رندر RTL
│  └─ types.ts, format.ts, db.ts
└─ prisma/schema.prisma        # User, UserSettings, Favorite, WatchlistItem,
                               # WatchHistoryEntry, SearchQuery
public/
├─ art/        # ۱۳ اثر گرافیکی اختصاصی
├─ icons/      # آیکون PWA/اپ (192/512)
├─ subtitles/  # ترک‌های نمایشی fa/en
├─ manifest.json
└─ downloads/  # CineVerse.apk + cineverse-source.zip

android/                        # پروژه بومی APK (بدون Gradle)
├─ app/AndroidManifest.xml
├─ app/java/com/cineverse/app/MainActivity.java   # WebView + دیالوگ آدرس سرور + DownloadManager
├─ app/res/mipmap-*                               # آیکون‌های ۵ تراکم
├─ build.sh     # کل زنجیره build: aapt2 → ecj → d8 → zipalign → apksigner
├─ gen-icons.mjs
└─ README-ANDROID.md   # debug.keystore در اولین build به‌صورت خودکار ساخته می‌شود
```

**لایه‌بندی ماژول‌ها:** UI/Design System · Navigation (Zustand stack) · Authentication (zero-config + مهمان) · Media Metadata (Cinemeta آداپتور) · Playback Sources (۶ سرور + file-mode آداپتور) · Video Player (hls.js + embed) · Subtitle Tracks (RTL) · Storage (SQLite + کوکی امن) · Library · Settings · Error Handling.

## قابلیت‌های پیاده‌سازی‌شده و آزمایش‌شده

| قابلیت | وضعیت |
|---|---|
| Splash سینمایی + Welcome با حساب صفرتنظیم/مهمان | ✅ |
| ثبت‌نام/ورود (bcrypt) + ارتقای مهمان با حفظ کتابخانه | ✅ |
| متادیتای زنده کل فیلم‌ها و سریال‌ها (Cinemeta/IMDb، بدون کلید) | ✅ |
| خانه: Hero چرخان، ریل‌های زنده، ادامه تماشا | ✅ |
| جستجوی زنده میلیون‌ها عنوان (debounce + فیلتر نوع + تاریخچه) | ✅ |
| جزئیات کامل: پوستر/بک‌دراپ/عوامل/جوایز/فصل‌قسمت واقعی/مشابه‌ها | ✅ |
| پخش با ۶ سرور قابل تعویض + پخش فایل (HLS/MP4) | ✅ |
| زیرنویس فارسی RTL (موتور اختصاصی + OpenSubtitles) | ✅ |
| دانلود مستقیم (Archive.org) + دانلودر بومی در APK | ✅ |
| علاقه‌مندی/لیست تماشا/ادامه تماشا/تاریخچه (پایدار در DB) | ✅ |
| تنظیمات (سرور پیش‌فرض، کیفیت، زیرنویس، حریم خصوصی) | ✅ |
| APK اندروید نصب‌شدنی با آیکون و دیالوگ اتصال | ✅ |
| ورود Google | 🟡 آماده اتصال — بدون کلید OAuth دکمه رندر نمی‌شود؛ مسیر API صادقانه 503 |

## منابع داده و پخش — شفافیت کامل

- **متادیتا:** Cinemeta (پایگاه داده IMDb پروژه Stremio) — عمومی و بدون کلید؛ کش ۱۰ دقیقه‌ای + fallback میزبان.
- **پخش:** ۶ سرور embed عمومی (قابل تعویض از داخل پلیر و تنظیمات) + پخش مستقیم فایل. دسترس‌پذیری/کیفیت وابسته به سرویس‌های شخص ثالث و شبکه شماست؛ برای هر عنوان می‌توانید سرور دیگری امتحان کنید.
- **دانلود:** برای عنوان‌هایی که نسخه آزاد دارند (مثل آرشیو فیلم‌های مالکیت عمومی Archive.org) لینک مستقیم MP4 داده می‌شود؛ برای بقیه، صادقانه «فایل مستقیم یافت نشد» نمایش داده می‌شود.
- **زیرنویس:** OpenSubtitles addon عمومی + پشتیبانی از بارگذاری فایل SRT/VTT کاربر.
- برای استفاده تجاری، منابع دارای لایسنس جایگزین کنید — آداپتورها طوری طراحی شده‌اند که فقط با ویرایش یک فایل تعویض می‌شوند.

## احراز هویت — وضعیت واقعی

- **مسیر پیش‌فرض (بدون هیچ تنظیماتی):** حساب ایمیل/نام‌کاربری + رمز با bcrypt؛ مهمان واقعی سمت سرور؛ ارتقای درجا با حفظ کامل کتابخانه.
- **Google Sign-In:** جریان OAuth 2.0 رسمی پیاده شده است؛ برای فعال‌سازی، `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` را در `.env` بگذارید (راهنما در About اپ). بدون کلید، هیچ دکمه ساختگی رندر نمی‌شود.

## Build اندروید از سورس

پوشه `android/` کل پروژه بومی است و **بدون Gradle/Android Studio** با سه پیش‌نیاز سبک build می‌شود:

1. JDK 8+ (فقط `java`/`keytool` کافی است — JRE هم کار می‌کند)
2. Android SDK: `platforms;android-34` + `build-tools;34.0.0` (با cmdline-tools قابل دانلود است)
3. Eclipse Compiler (ecj) — دستور دانلود در `android/README-ANDROID.md`

```bash
cd android && ./build.sh
# خروجی: out/CineVerse.apk  (امضاشده، آماد نصب)
```

جزئیات کامل: `android/README-ANDROID.md`.

## امنیت

- کوکی نشست: `httpOnly` + امضای HMAC-SHA256 (`AUTH_SECRET`) — در JS کلاینت خوانده نمی‌شود
- رمزها با bcrypt (cost 10) هش می‌شوند؛ هیچ کلید محرمانه‌ای در کلاینت/APK نیست
- داده هر کاربر با `userId` جداست؛ حذف حساب = حذف cascade همه ردیف‌ها
- APK هیچ مجوز اضافه‌ای نمی‌خواهد: فقط INTERNET و ACCESS_NETWORK_STATE

## توسعه و مشارکت

**هر کسی که بخواهد این پروژه را گسترش دهد یا در آن تغییر ایجاد کند، کاملاً آزاد است — نیازی به اجازه نیست** (لایسنس MIT). نقاط تماس آداپتوری برای افزودن سرور پخش، تعویض پروایدر متادیتا و پورت به React Native آماده است؛ Pull Request هم خوش‌آمدگویی می‌شود.

## نکته نسخه نمایشی

دسترس‌پذیری سرورهای پخش/دانلود به سرویس‌های عمومی شخص ثالث و شبکه کاربر وابسته است. برای تولید واقعی: منابع دارای لایسنس + زیرنویس رسمی + استقرار روی سرور اختصاصی با HTTPS.

`Built by Alireza Rajaee`
