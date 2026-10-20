'use client'

import { useEffect } from 'react'
import {
  ArrowRight, Captions, Database, Download, Heart, Info, PlayCircle, ShieldCheck,
} from 'lucide-react'
import { useNav } from '@/lib/store'
import { CineVerseLogo } from './SplashScreen'

export function AboutScreen() {
  const { pop } = useNav()

  useEffect(() => { document.title = 'درباره CineVerse' }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 py-3.5">
        <button
          onClick={pop}
          aria-label="بازگشت"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-card"
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="text-[16px] font-black">درباره CineVerse</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24">
        <div className="flex flex-col items-center pt-8">
          <CineVerseLogo size="sm" />
          <p className="mt-2 text-[10px] text-muted-foreground" dir="ltr">v1.0.0 — Web</p>
        </div>

        <p className="mt-5 text-center text-[12.5px] leading-7 text-foreground/85">
          CineVerse — کشف و تماشای فیلم، سریال و انیمیشن؛ نسخه وب.
          <br />
          جست‌وجو در کل آرشیو جهانی، پخش آنلاین با سرورهای قابل تعویض، زیرنویس فارسی و کتابخانه‌ی شخصی شما.
        </p>

        <section className="mt-7">
          <h2 className="text-[13px] font-black">منابع داده و پخش</h2>
          <ul className="mt-3 space-y-3">
            <SourceRow
              icon={<Database className="h-4 w-4" aria-hidden />}
              title="متادیتا"
              body={
                <>دیتابیس زنده IMDb (Cinemeta) — بدون کلید، با پوشش کامل فیلم و سریال جهان؛ عنوان، سال، امتیاز، خلاصه، بازیگران و فصل‌ها به‌صورت زنده دریافت می‌شود.</>
              }
            />
            <SourceRow
              icon={<Captions className="h-4 w-4" aria-hidden />}
              title="زیرنویس"
              body={<>OpenSubtitles — شامل زیرنویس فارسی واقعی؛ در صورت نبودن ترک فارسی، سایر زبان‌ها پیشنهاد می‌شود.</>}
            />
            <SourceRow
              icon={<PlayCircle className="h-4 w-4" aria-hidden />}
              title="پخش"
              body={<>سرورهای عمومی جاسازی‌شده (ویدلینک، ویدسورس، توامبد، مولتی‌امبد) با قابلیت تعویض سرور داخل پخش‌کننده.</>}
            />
            <SourceRow
              icon={<Download className="h-4 w-4" aria-hidden />}
              title="دانلود"
              body={<>فایل‌های مستقیم قانونی از Internet Archive (تعداد محدود) — برای سایر عناوین، پخش آنلاین در دسترس است.</>}
            />
          </ul>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/10 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="text-[11px] leading-6 text-foreground/85">
              کیفیت و در دسترس بودن هر سرور به آن سرویس وابسته است؛ اگر سروری کار نکرد، از داخل
              پخش‌کننده سرور دیگری را امتحان کنید.
            </p>
          </div>
        </section>

        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-[13px] font-black">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> حریم خصوصی
          </h2>
          <ul className="mt-3 space-y-2 text-[11px] leading-6 text-muted-foreground">
            <li>• داده‌های شما (حساب، علاقه‌مندی‌ها، لیست تماشا، تاریخچه) فقط در پایگاه‌داده محلی همین سرویس ذخیره می‌شود.</li>
            <li>• رمزهای عبور با bcrypt هش می‌شوند و هرگز به‌صورت خام ذخیره یا منتقل نمی‌شوند.</li>
            <li>• بدون ردیاب؛ هیچ سرویس تحلیلی یا تبلیغاتی در برنامه وجود ندارد.</li>
            <li>• هر زمان می‌توانید از صفحه پروفایل، حساب و همه داده‌های خود را به‌صورت دائمی حذف کنید.</li>
          </ul>
        </section>

        <div className="mt-8 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-center">
          <p className="text-[14px] font-black text-primary">ساخته‌شده توسط علیرضا رجایی</p>
          <p className="mt-0.5 text-[11px] font-bold text-primary/90" dir="ltr">Built by Alireza Rajaee</p>
        </div>

        <p className="mt-3 text-center text-[10px] leading-5 text-muted-foreground/70" dir="ltr">
          Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui · Prisma
        </p>

        <div className="mt-6 mb-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50">
          <Heart className="h-3 w-3 fill-primary text-primary" aria-hidden /> ساخته‌شده برای سینمادوستان فارسی‌زبان
        </div>
      </div>
    </div>
  )
}

function SourceRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-card/50 p-3.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-elevated text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold">{title}</p>
        <p className="mt-0.5 text-[11px] leading-6 text-muted-foreground">{body}</p>
      </div>
    </li>
  )
}
