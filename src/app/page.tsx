import Link from "next/link";
import { Send, Zap, Bell, CheckCircle2, ShieldCheck, Sparkles, MapPin, Briefcase, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JOB_CATEGORIES } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[340px] w-[600px] rounded-full bg-sky-500/10 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-400 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Telegram-First AI Job Discovery for Ethiopia</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Set your preferences once. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-400">
              Get notified on Telegram.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-slate-300 max-w-2xl mx-auto">
            Signal Job continuously curates top verified Ethiopian opportunities — internships, entry-level, NGO, tech, and finance roles — and pings you the moment a direct match is published.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 cursor-pointer"
            >
              <Send className="h-5 w-5" />
              <span>Launch Telegram Bot</span>
            </a>
            <Link href="/admin">
              <Button variant="secondary" size="lg" className="gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-400" />
                <span>Admin Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Telegram Message Preview Card */}
      <section className="w-full max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-sky-500/5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Telegram Notification Preview
              </span>
            </div>
            <Badge variant="success">92% Match</Badge>
          </div>

          <div className="space-y-3 font-sans text-sm text-slate-200">
            <div className="font-semibold text-base text-white">
              🆕 Software Developer — Ethiopian Tech Corp
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                <MapPin className="h-3.5 w-3.5 text-sky-400" />
                <span>Addis Ababa (Bole)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                <Briefcase className="h-3.5 w-3.5 text-sky-400" />
                <span>Entry Level (0-2 yrs)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                <GraduationCap className="h-3.5 w-3.5 text-sky-400" />
                <span>B.Sc. Computer Science</span>
              </div>
            </div>
            <p className="text-xs italic text-slate-400 pt-1">
              "Building modern web applications using TypeScript and Next.js. Fast-growing engineering team with mentorship."
            </p>
            <div className="pt-2 flex gap-2">
              <span className="rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 border border-sky-500/30">
                🔗 View & Apply Original Post
              </span>
              <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-700">
                ⭐ Save Job
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            How Signal Job Works
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            A frictionless discovery flow engineered specifically for job seekers in Ethiopia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 mb-2">
                <Send className="h-5 w-5" />
              </div>
              <CardTitle>1. Start Bot & Set Preferences</CardTitle>
              <CardDescription>
                Press /start on Telegram. Choose your profession, target experience level, and preferred location in 30 seconds.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 mb-2">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle>2. AI Processing & Matching</CardTitle>
              <CardDescription>
                Raw job listings are structured and verified. Our deterministic matching engine checks your exact criteria.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 mb-2">
                <Bell className="h-5 w-5" />
              </div>
              <CardTitle>3. Instant Direct Notification</CardTitle>
              <CardDescription>
                Get alerted the moment a verified opportunity matches your profile, with a direct link to the original application.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Ethiopian Job Categories Covered */}
      <section className="w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
          <h3 className="text-lg font-bold text-white mb-4">Supported Opportunities in Ethiopia</h3>
          <div className="flex flex-wrap gap-2">
            {JOB_CATEGORIES.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
                {cat.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
