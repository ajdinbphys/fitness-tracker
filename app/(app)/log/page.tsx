'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatPace, formatVolume, type ExerciseRecord } from '@/lib/metrics'

interface ParsedWorkout {
  activityType: string
  durationMinutes: number | null
  perceivedEffort: number | null
  date: string
  notes: string | null
  running: {
    distanceKm: number | null
    paceMinPerKm: number | null
    paceKmPerH: number | null
  } | null
  exercises: ExerciseRecord[]
  totalVolumeKg: number | null
}

interface WorkoutEntry {
  id: string
  raw_input: string
  activity_type: string | null
  duration_minutes: number | null
  logged_at: string
  distance_km: number | null
  pace_min_per_km: number | null
  pace_km_per_h: number | null
  exercises_json: ExerciseRecord[] | null
  total_volume_kg: number | null
  parsed_json: {
    perceivedEffort?: number | null
  }
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
  const [logDate, setLogDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<LogResult | null>(null)
  const [history, setHistory] = useState<WorkoutEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  function handleUpdate(updated: WorkoutEntry) {
    setHistory(prev => prev.map(w => w.id === updated.id ? updated : w))
  }

  function handleDelete(id: string) {
    setHistory(prev => prev.filter(w => w.id !== id))
  }
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
      body: JSON.stringify({ rawInput: input, logDate }),
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Log</p>
        <h1 className="text-2xl font-semibold tracking-tight">Log a workout</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Type anything — Claude extracts the structured data automatically
        </p>
      </div>

      {/* ── Input card ── */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card overflow-hidden">
        <Textarea
          ref={textareaRef}
          placeholder={'e.g. "ran 8km in 42 min, felt strong"\nor "chest day — bench 4×8 at 80kg, cable fly 3×15 at 20kg"'}
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
          <input
            type="date"
            value={logDate}
            max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()}
            onChange={e => setLogDate(e.target.value)}
            disabled={loading}
            className="text-[11px] text-muted-foreground bg-transparent border-0 outline-none cursor-pointer hover:text-foreground transition-colors"
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()} className="ml-auto">
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

      {/* ── Confirmation ── */}
      {lastResult && (
        <ConfirmationCard result={lastResult} />
      )}

      {/* ── History ── */}
      <section>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">History</p>
        {historyLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-muted-foreground animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No workouts logged yet.</p>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {history.map((w) => (
              <WorkoutHistoryRow key={w.id} workout={w} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Confirmation card ────────────────────────────────────────────────────────

function ConfirmationCard({ result }: { result: LogResult }) {
  const { parsed } = result
  const isRunning = parsed.running?.distanceKm != null || parsed.running?.paceMinPerKm != null
  const isLifting = parsed.exercises.length > 0

  return (
    <div className="rounded-xl border border-emerald-500/20 border-l-2 border-l-emerald-500 bg-emerald-500/5 overflow-hidden">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Logged</p>
        </div>

        <p className="text-sm text-foreground/80 italic">&ldquo;{result.workout.raw_input}&rdquo;</p>

        {/* Top-level chips */}
        <div className="flex flex-wrap gap-1.5">
          {parsed.activityType && <Chip>{parsed.activityType}</Chip>}
          {parsed.durationMinutes && <Chip>{parsed.durationMinutes} min</Chip>}
          {parsed.perceivedEffort && <Chip>RPE {parsed.perceivedEffort}/10</Chip>}
        </div>

        {/* Running metrics */}
        {isRunning && parsed.running && (
          <div className="rounded-lg bg-blue-500/8 border border-blue-500/15 px-3.5 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Running</p>
            <div className="flex flex-wrap gap-3">
              {parsed.running.distanceKm && (
                <div>
                  <p className="text-base font-semibold tabular-nums">{parsed.running.distanceKm} km</p>
                  <p className="text-[10px] text-muted-foreground">distance</p>
                </div>
              )}
              {parsed.running.paceMinPerKm && (
                <div>
                  <p className="text-base font-semibold tabular-nums">{formatPace(parsed.running.paceMinPerKm)} /km</p>
                  <p className="text-[10px] text-muted-foreground">pace</p>
                </div>
              )}
              {parsed.running.paceKmPerH && (
                <div>
                  <p className="text-base font-semibold tabular-nums">{parsed.running.paceKmPerH} km/h</p>
                  <p className="text-[10px] text-muted-foreground">speed</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exercises */}
        {isLifting && (
          <div className="rounded-lg bg-orange-500/8 border border-orange-500/15 px-3.5 py-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Exercises</p>
              {parsed.totalVolumeKg && (
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-medium text-foreground">{formatVolume(parsed.totalVolumeKg)} kg</span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              {parsed.exercises.map((ex, i) => (
                <ExerciseRow key={i} ex={ex} />
              ))}
            </div>
          </div>
        )}

        {parsed.notes && (
          <p className="text-xs text-muted-foreground">{parsed.notes}</p>
        )}
      </div>
    </div>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────

function WorkoutHistoryRow({ workout: w, onUpdate, onDelete }: { workout: WorkoutEntry; onUpdate: (updated: WorkoutEntry) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editInput, setEditInput] = useState(w.raw_input)
  const [editDate, setEditDate] = useState(() => {
    const d = new Date(w.logged_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const hasExercises = (w.exercises_json?.length ?? 0) > 0
  const isRunning = w.distance_km != null || w.pace_min_per_km != null

  async function handleEditSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    const res = await fetch(`/api/log/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: editInput, logDate: editDate }),
    })
    const data = await res.json()
    setEditLoading(false)
    if (!res.ok) { setEditError(data.error ?? 'Update failed'); return }
    onUpdate(data.workout)
    setEditing(false)
  }

  async function handleDelete() {
    setDeleteLoading(true)
    const res = await fetch(`/api/log/${w.id}`, { method: 'DELETE' })
    setDeleteLoading(false)
    if (res.ok) onDelete(w.id)
  }

  return (
    <div
      className={cn('px-5 py-4', !editing && hasExercises && 'cursor-pointer hover:bg-muted/20 transition-colors')}
      onClick={() => !editing && hasExercises && setExpanded(v => !v)}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {editing ? (
            <form onSubmit={handleEditSubmit} onClick={e => e.stopPropagation()} className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                rows={3}
                value={editInput}
                onChange={e => setEditInput(e.target.value)}
                autoFocus
                disabled={editLoading}
              />
              <input
                type="date"
                value={editDate}
                max={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()}
                onChange={e => setEditDate(e.target.value)}
                disabled={editLoading}
                className="text-xs text-muted-foreground bg-transparent border border-border/60 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
              />
              {editError && <p className="text-xs text-destructive">{editError}</p>}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={editLoading || !editInput.trim()} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => { setEditing(false); setEditInput(w.raw_input); setEditError('') }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm leading-snug">{w.raw_input}</p>
          )}

          {/* Metric chips */}
          <div className="flex flex-wrap gap-1.5">
            {w.activity_type && <Chip>{w.activity_type}</Chip>}
            {w.duration_minutes && <Chip>{w.duration_minutes} min</Chip>}

            {/* Running */}
            {isRunning && (
              <>
                {w.distance_km && <Chip>{w.distance_km} km</Chip>}
                {w.pace_min_per_km && <Chip>{formatPace(w.pace_min_per_km)} /km</Chip>}
                {w.pace_km_per_h && <Chip>{w.pace_km_per_h} km/h</Chip>}
              </>
            )}

            {/* Lifting */}
            {w.total_volume_kg && <Chip>{formatVolume(w.total_volume_kg)} kg vol</Chip>}

            {w.parsed_json?.perceivedEffort && (
              <Chip>RPE {w.parsed_json.perceivedEffort}/10</Chip>
            )}
          </div>

          {/* Collapsed exercise names */}
          {hasExercises && !expanded && (
            <p className="text-[11px] text-muted-foreground">
              {w.exercises_json!.map(ex => ex.exerciseName).join(' · ')}
              <span className="ml-1.5 text-primary/70">↓</span>
            </p>
          )}

          {/* Expanded exercise table */}
          {hasExercises && expanded && (
            <div className="mt-2 rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exercise</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Muscles</th>
                    <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sets × Reps</th>
                    <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Weight</th>
                    <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {w.exercises_json!.map((ex, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{ex.exerciseName}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {ex.muscleGroups?.join(', ')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {ex.sets != null && ex.reps != null ? `${ex.sets}×${ex.reps}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {ex.weightKg != null ? `${ex.weightKg} kg` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {ex.volumeKg != null ? `${formatVolume(ex.volumeKg)} kg` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {w.total_volume_kg && (
                  <tfoot>
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={4} className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Total volume</td>
                      <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">
                        {formatVolume(w.total_volume_kg)} kg
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
          <time className="text-xs text-muted-foreground">
            {new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </time>
          {!editing && !confirmDelete && (
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); setEditing(true) }}
                className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Edit
              </button>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                className="text-[11px] text-muted-foreground/40 hover:text-rose-500 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="text-[11px] font-medium text-rose-500 hover:text-rose-400 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExerciseRow({ ex }: { ex: ExerciseRecord }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-xs font-medium">{ex.exerciseName}</span>
        {ex.muscleGroups?.length > 0 && (
          <span className="text-[10px] text-muted-foreground ml-2">{ex.muscleGroups.join(', ')}</span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        {ex.sets != null && ex.reps != null && (
          <span className="text-foreground/80">{ex.sets}×{ex.reps}</span>
        )}
        {ex.weightKg != null && <span>@ {ex.weightKg} kg</span>}
        {ex.volumeKg != null && (
          <span className="text-orange-400/80 font-medium">{formatVolume(ex.volumeKg)} kg</span>
        )}
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
