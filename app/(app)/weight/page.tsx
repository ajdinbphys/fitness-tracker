'use client'

import { useState, useEffect } from 'react'

interface WeightLog {
  id: string
  logged_date: string
  weight_kg: number
}

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) return null

  const chronological = [...logs].reverse()
  const weights = chronological.map(l => l.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const W = 320
  const H = 56
  const pad = 4

  const points = weights.map((w, i) => {
    const x = pad + (i / (weights.length - 1)) * (W - pad * 2)
    const y = pad + ((max - w) / range) * (H - pad * 2)
    return `${x},${y}`
  })

  const first = weights[0]
  const last = weights[weights.length - 1]
  const delta = last - first
  const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1)
  const deltaColor = delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-rose-400' : 'text-muted-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{last} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Current weight</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium tabular-nums ${deltaColor}`}>{deltaStr} kg</p>
          <p className="text-xs text-muted-foreground mt-0.5">vs 90 days ago</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {/* Last point dot */}
        <circle
          cx={points[points.length - 1].split(',')[0]}
          cy={points[points.length - 1].split(',')[1]}
          r="3"
          fill="hsl(var(--primary))"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>{new Date(chronological[0].logged_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span>{new Date(chronological[chronological.length - 1].logged_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayLocal())
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchLogs() }, [])

  // Pre-fill weight input when date changes to a logged entry
  useEffect(() => {
    const existing = logs.find(l => l.logged_date === date)
    setWeight(existing ? String(existing.weight_kg) : '')
  }, [date, logs])

  async function fetchLogs() {
    setLoading(true)
    try {
      const res = await fetch('/api/weight')
      const data = await res.json()
      if (res.ok) setLogs(data.logs ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    const kg = parseFloat(weight)
    if (!date || isNaN(kg) || kg < 20 || kg > 500) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, weightKg: kg }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    // Update local state
    setLogs(prev => {
      const filtered = prev.filter(l => l.logged_date !== date)
      return [data.log, ...filtered].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
    })
  }

  const todayEntry = logs.find(l => l.logged_date === todayLocal())
  const isEditing = logs.some(l => l.logged_date === date)

  return (
    <div className="space-y-10 max-w-2xl">

      {/* Header */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Body</p>
        <h1 className="text-2xl font-semibold tracking-tight">Weight journal</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Log your weight daily to track progress over time</p>
      </div>

      {/* Sparkline */}
      {!loading && <Sparkline logs={logs} />}

      {/* Log form */}
      <section className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          {isEditing ? 'Update entry' : 'Log weight'}
        </p>
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="log-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </label>
              <input
                id="log-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                max={todayLocal()}
                required
                className="w-full h-10 rounded-md border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="log-weight" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Weight (kg)
              </label>
              <input
                id="log-weight"
                type="number"
                placeholder={todayEntry ? String(todayEntry.weight_kg) : '70.0'}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                min={20}
                max={500}
                step="0.1"
                required
                className="w-full h-10 rounded-md border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !weight}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
          </button>
        </form>
      </section>

      {/* History */}
      <section>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">History</p>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-muted-foreground animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No entries yet. Log your first weight above.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {logs.map((log, i) => {
              const prev = logs[i + 1]
              const delta = prev ? log.weight_kg - prev.weight_kg : null
              const isToday = log.logged_date === todayLocal()
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setDate(log.logged_date)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium tabular-nums">
                      {log.weight_kg} kg
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(log.logged_date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                      {isToday && <span className="ml-2 text-primary">Today</span>}
                    </p>
                  </div>
                  {delta !== null && (
                    <span className={`text-xs font-medium tabular-nums ${
                      delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-rose-400' : 'text-muted-foreground'
                    }`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/50">edit →</span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
