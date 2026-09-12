import Link from "next/link";
import { Radio, ShieldCheck, Send } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">Signal Job</span>
            <span className="ml-1.5 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">
              ETHIOPIA
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            How it works
          </Link>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span>Admin</span>
          </Link>
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-400"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Telegram Bot</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
