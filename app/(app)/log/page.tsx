'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ParsedWorkout {
  activityType: string
  durationMinutes: number | null
  distance: string | null
  perceivedEffort: number | null
  date: string
  exercises: Array<{
    name: string
    sets: number | null
    reps: number | null
    weight: string | null
  }>
  notes: string | null
}

interface WorkoutEntry {
  id: string
  raw_input: string
  activity_type: string | null
  duration_minutes: number | null
  logged_at: string
  parsed_json: ParsedWorkout
}

interface LogResult {
  workout: WorkoutEntry
  parsed: ParsedWorkout
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      {children}
    </span>
  )
}

export default function LogPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<LogResult | null>(null)
  const [history, setHistory] = useState<WorkoutEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/log/history')
      const data = await res.json()
      if (res.ok) setHistory(data.workouts ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    setError('')
    setLastResult(null)

    const res = await fetch('/api/log/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: input }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    setLastResult(data)
    setInput('')
    setLoading(false)
    fetchHistory()
  }

  return (
    <div className="space-y-12 max-w-2xl">

      {/* ── Header ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
          Log
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Log a workout</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Type anything — Claude extracts the structured data automatically
        </p>
      </div>

      {/* ── Input card ── */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
        <Textarea
          ref={textareaRef}
          placeholder={'e.g. "did 5km this morning, felt tired"\nor "chest day — bench press 4×8 at 80kg, felt strong"'}
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={4}
          className="resize-none border-0 rounded-none bg-transparent text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 px-5 pt-4 pb-3"
          disabled={loading}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            ⌘ Return to submit
          </p>
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="ml-auto"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                Parsing…
              </span>
            ) : 'Log workout'}
          </Button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Confirmation card ── */}
      {lastResult && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 border-l-2 border-l-emerald-500 overflow-hidden">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Logged</p>
            </div>

            <p className="text-sm text-foreground/80 italic">
              &ldquo;{lastResult.workout.raw_input}&rdquo;
            </p>

            <div className="flex flex-wrap gap-1.5">
              {lastResult.parsed.activityType && (
                <Chip>{lastResult.parsed.activityType}</Chip>
              )}
              {lastResult.parsed.durationMinutes && (
                <Chip>{lastResult.parsed.durationMinutes} min</Chip>
              )}
              {lastResult.parsed.distance && (
                <Chip>{lastResult.parsed.distance}</Chip>
              )}
              {lastResult.parsed.perceivedEffort && (
                <Chip>RPE {lastResult.parsed.perceivedEffort}/10</Chip>
              )}
            </div>

            {lastResult.parsed.exercises.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Exercises</p>
                {lastResult.parsed.exercises.map((ex, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {ex.name}
                    {ex.sets && ex.reps ? ` — ${ex.sets}×${ex.reps}` : ''}
                    {ex.weight ? ` @ ${ex.weight}` : ''}
                  </p>
                ))}
              </div>
            )}

            {lastResult.parsed.notes && (
              <p className="text-xs text-muted-foreground">{lastResult.parsed.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* ── History ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
          History
        </p>

        {historyLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-muted-foreground animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No workouts logged yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {history.map((w) => (
              <div key={w.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-foreground leading-snug">{w.raw_input}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {w.activity_type && <Chip>{w.activity_type}</Chip>}
                    {w.duration_minutes && <Chip>{w.duration_minutes} min</Chip>}
                    {w.parsed_json?.distance && <Chip>{w.parsed_json.distance}</Chip>}
                    {w.parsed_json?.perceivedEffort && (
                      <Chip>RPE {w.parsed_json.perceivedEffort}/10</Chip>
                    )}
                  </div>
                  {w.parsed_json?.exercises?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {w.parsed_json.exercises.map(ex => ex.name).join(', ')}
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground pt-0.5">
                  {new Date(w.logged_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  })}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
