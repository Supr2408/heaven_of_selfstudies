import Link from 'next/link';
import { ArrowRight, BookOpen, MessageCircle, Search, UploadCloud, Users, ShieldCheck } from 'lucide-react';

export default function DashboardMissionPanel() {
  return (
    <section className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-sky-800 to-blue-600 p-6 text-white shadow-sm">
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen">
        <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-sky-400/40 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-indigo-500/40 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200">
            Why this platform exists
          </p>
          <h2 className="text-2xl font-bold leading-snug md:text-3xl">
            Free NPTEL Assignments, PYQs & Discussions —
            <span className="block text-sky-200">Built for students, by students.</span>
          </h2>
        </header>

        <p className="text-sm leading-6 text-sky-100 md:text-[0.95rem]">
          Your library brings together previous year NPTEL assignments, week-by-week answers, exam-
          focused questions, and peer discussions — completely free, with no hidden costs or paywalls.
        </p>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="flex gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-100">
              <BookOpen size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">PYQs & weekly assignments</p>
              <p className="mt-1 text-xs text-sky-100/80">
                Browse previous year questions and week-wise answers in one place.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-50">
              <MessageCircle size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Discussion & doubt solving</p>
              <p className="mt-1 text-xs text-sky-100/80">
                Learn from other learners&apos; questions, answers, and clarifications.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-50">
              <Search size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Smart search across courses</p>
              <p className="mt-1 text-xs text-sky-100/80">
                Quickly jump to topics, weeks, or assignments from any run.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/25 text-amber-50">
              <ArrowRight size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">Fast, simple, minimal login</p>
              <p className="mt-1 text-xs text-sky-100/80">
                Get to study materials in a few clicks, without complex sign-up flows.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-1 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              Contribute to the community
            </p>
            <div className="mt-3 flex gap-3 text-sm">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-100">
                <UploadCloud size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">Help keep NPTEL free for everyone</p>
                <p className="mt-1 text-xs text-sky-100/80">
                  Upload missing materials, share your notes, and strengthen a free learning
                  ecosystem for future learners.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-50">
                <Users size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold">Built with exam prep in mind</p>
                <p className="mt-1 text-xs text-sky-100/80">
                  Used by students preparing for NPTEL exams who want structured, week-wise
                  revision instead of scattered links.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-sky-100/80">
              <ShieldCheck size={14} />
              <span>Always free. No ads. No hidden costs.</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Link
            href="/assignments"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            Explore free materials
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-sky-100/80">
            Start with any course in your library or browse a new NPTEL run.
          </p>
        </div>
      </div>
    </section>
  );
}
