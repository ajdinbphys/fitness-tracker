'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  goal: string
  plan_json: { summary: string; totalWeeks?: number }
  week_start_date: string
  created_at: string
}

export default function PlanCard({ plan }: { plan: Plan }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const totalWeeks = plan.plan_json.totalWeeks
  const startDate = new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/plan/${plan.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium leading-snug">{plan.goal}</p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{plan.plan_json.summary}</p>
        <div className="flex items-center gap-3 pt-0.5">
          <span className="text-[11px] text-muted-foreground">Started {startDate}</span>
          {totalWeeks && (
            <span className="text-[11px] text-muted-foreground">{totalWeeks} weeks</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-muted-foreground">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-muted-foreground hover:text-rose-400 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
