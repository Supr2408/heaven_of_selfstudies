import Link from 'next/link';
import { ArrowRight, BookOpen, MessageCircle, Search, ShieldCheck } from 'lucide-react';

const highlights = [
  {
    icon: BookOpen,
    title: 'Previous-year material in one place',
    description: 'Move from assignments to notes and weekly resources without hopping across pages.',
  },
  {
    icon: MessageCircle,
    title: 'Community-backed revision',
    description: 'Keep helpful discussions and clarifications close to the week you are studying.',
  },
  {
    icon: Search,
    title: 'Fast course lookup',
    description: 'Jump into saved runs or discover a new NPTEL course with fewer clicks.',
  },
];

export default function DashboardMissionPanel() {
  return (
    <section className="flex h-full flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            Why this platform exists
          </p>
          <h2 className="max-w-xl text-3xl font-semibold leading-tight text-slate-950 md:text-[2rem]">
            A simpler NPTEL workspace for revision, assignments, and discussions.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-[0.95rem]">
            Bring previous-year material, week-wise answers, and learner discussions into one clean
            study space - free to use and easy to revisit.
          </p>
        </header>

        <div className="space-y-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck size={16} />
            Always free for learners
          </div>
          <p className="text-sm text-slate-300">
            No paywall, no clutter, and a better place to keep your NPTEL prep organized.
          </p>
        </div>

        <Link
          href="/courses"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          Explore materials
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
