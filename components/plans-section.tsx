'use client'

import { useState } from 'react'
import Link from 'next/link'
import WeekCalendar, { type Plan } from '@/components/week-calendar'
import { type WorkoutRow } from '@/lib/metrics'

interface PlansSectionProps {
  plans: Plan[]
  initialWorkouts: WorkoutRow[]   // pre-fetched for plans[0]'s week
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export default function PlansSection({ plans: initialPlans, initialWorkouts }: PlansSectionProps) {
  const [plans, setPlans] = useState(initialPlans)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null) // plan id being confirmed
  const [deleting, setDeleting] = useState(false)

  const plan = plans[selectedIdx] ?? plans[0]

  async function handleDelete(planId: string) {
    setDeleting(true)
    const res = await fetch(`/api/plan/${planId}`, { method: 'DELETE' })
    if (res.ok) {
      const next = plans.filter(p => p.id !== planId)
      setPlans(next)
      setSelectedIdx(prev => Math.min(prev, Math.max(0, next.length - 1)))
    }
    setDeleting(false)
    setConfirming(null)
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-8 py-16 text-center">
        <p className="text-sm text-muted-foreground mb-5">No training plans.</p>
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Create a plan
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Plan tabs (only shown if >1 plan) ── */}
      {plans.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1">
          {plans.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setSelectedIdx(i)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                i === selectedIdx
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {p.goal.length > 40 ? p.goal.slice(0, 40) + '…' : p.goal}
            </button>
          ))}
        </div>
      )}

      {/* ── Goal banner ── */}
      <div className="rounded-xl border border-border bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5">Current goal</p>
            <p className="text-base font-medium leading-snug">{plan.goal}</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{plan.plan_json.summary}</p>
          </div>
          <div className="shrink-0 text-right hidden sm:flex flex-col items-end gap-3">
            {plan.week_start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Started</p>
                <p className="text-sm font-medium mt-0.5">
                  {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Link href="/onboarding" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                New plan →
              </Link>
              {confirming === plan.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Delete?</span>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    disabled={deleting}
                    className="font-medium text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(plan.id)}
                  className="text-xs text-muted-foreground hover:text-rose-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar ── */}
      <WeekCalendar
        key={plan.id}
        plan={plan}
        initialWorkouts={selectedIdx === 0 ? initialWorkouts : []}
      />

      {/* ── Coaching tips ── */}
      {plan.plan_json.tips?.length > 0 && (
        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">Coaching tips</p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {plan.plan_json.tips.map((tip, i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
