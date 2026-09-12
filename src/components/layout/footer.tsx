export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-sm text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} Signal Job — Ethiopian Telegram-First Job Discovery Assistant.</p>
        <p className="text-xs text-slate-600">Built for speed, relevance, and zero spam.</p>
      </div>
    </footer>
  );
}
