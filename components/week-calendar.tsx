'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatPace, formatVolume, formatDuration, type WorkoutRow } from '@/lib/metrics'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunningSegmentWarmCool {
  type: 'warmup' | 'cooldown' | 'tempo'
  distanceKm: number | null
  durationMinutes: number | null
  paceMinPerKm: number | null
}

interface RunningSegmentIntervals {
  type: 'intervals'
  reps: number
  repDistanceKm: number
  repPaceMinPerKm: number
  restSeconds: number
  restType: 'jog' | 'walk' | 'standing'
}

type RunningSegment = RunningSegmentWarmCool | RunningSegmentIntervals

interface RunningTargets {
  totalDistanceKm: number | null
  totalDurationMinutes: number | null
  paceMinPerKm: number | null
  paceKmPerH: number | null
  intensityType: string | null
  description: string | null
  segments: RunningSegment[] | null
}

interface PlanExercise {
  exerciseName: string
  muscleGroups: string[]
  sets: number
  reps: number
  weightGuidance: string
}

interface DayPlan {
  day: string
  date?: string
  focus: string
  workout: string
  duration: string
  isRest: boolean
  runningTargets?: RunningTargets | null
  exercises?: PlanExercise[]
}

interface PlanJson {
  summary: string
  weekStartDate?: string
  weeklyPlan: DayPlan[]
  tips: string[]
}

export interface Plan {
  id: string
  goal: string
  plan_json: PlanJson
  week_start_date: string
}

type DayStatus = 'upcoming' | 'completed' | 'missed' | 'rest'

interface WeekDay {
  date: string
  dayShort: string
  dayFull: string
  planDay: DayPlan | null
  loggedWorkout: WorkoutRow | null
  status: DayStatus
  isToday: boolean
}

interface WeekCalendarProps {
  plan: Plan
  initialWorkouts: WorkoutRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toDateStr(d)
}

function todayStr(): string {
  return toDateStr(new Date())
}

function weekLabel(weekStart: string): string {
  const today = todayStr()
  const thisMonday = getMondayOf(today)
  if (weekStart === thisMonday) return 'THIS WEEK'
  if (weekStart === addDays(thisMonday, -7)) return 'LAST WEEK'
  if (weekStart === addDays(thisMonday, 7)) return 'NEXT WEEK'
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function dayAccentClass(focus: string, isRest: boolean): string {
  if (isRest) return 'border-l-border/30'
  const f = focus.toLowerCase()
  if (f.includes('run') || f.includes('cardio') || f.includes('cycl') || f.includes('swim'))
    return 'border-l-blue-500'
  if (
    f.includes('strength') || f.includes('upper') || f.includes('lower') ||
    f.includes('push') || f.includes('pull') || f.includes('leg') || f.includes('gym')
  )
    return 'border-l-orange-500'
  if (f.includes('yoga') || f.includes('flex') || f.includes('mobil') || f.includes('stretch'))
    return 'border-l-emerald-500'
  return 'border-l-primary'
}

function statusDot(status: DayStatus): { color: string; label: string } {
  switch (status) {
    case 'completed': return { color: 'bg-emerald-500', label: 'Done' }
    case 'missed':    return { color: 'bg-rose-500/70', label: 'Missed' }
    case 'rest':      return { color: 'bg-muted-foreground/30', label: 'Rest' }
    case 'upcoming':  return { color: 'bg-muted-foreground/20', label: '' }
  }
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeekCalendar({ plan, initialWorkouts }: WeekCalendarProps) {
  const planWeekStart = getMondayOf(plan.week_start_date)

  const [weekStart, setWeekStart] = useState(planWeekStart)
  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutRow[]>(initialWorkouts)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current && weekStart === planWeekStart && initialWorkouts.length > 0) {
      isFirstRender.current = false
      return
    }
    isFirstRender.current = false
    setLoading(true)
    fetch(`/api/log/week?start=${weekStart}`)
      .then(r => r.json())
      .then(d => setWeekWorkouts(d.workouts ?? []))
      .finally(() => setLoading(false))
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayStr()

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const d = new Date(date + 'T00:00:00')

    // Match plan day by exact date field only
    const planDay = plan.plan_json.weeklyPlan.find(p => p.date === date) ?? null

    const loggedWorkout = weekWorkouts.find(w => toDateStr(new Date(w.logged_at)) === date) ?? null

    let status: DayStatus
    if (planDay?.isRest) {
      status = 'rest'
    } else if (loggedWorkout) {
      status = 'completed'
    } else if (date < today) {
      status = 'missed'
    } else {
      status = 'upcoming'
    }

    return {
      date,
      dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayFull: d.toLocaleDateString('en-US', { weekday: 'long' }),
      planDay,
      loggedWorkout,
      status,
      isToday: date === today,
    }
  })

  return (
    <section>
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            {weekLabel(weekStart)}
          </p>
          {loading && (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-border border-t-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(s => addDays(s, -7))}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Previous week"
          >
            ‹
          </button>

          <button
            onClick={() => setWeekStart(s => addDays(s, 7))}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Next week"
          >
            ›
          </button>
        </div>
      </div>

      {/* ── 7-day grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {weekDays.map((wd) => {
          const dot = statusDot(wd.status)
          const accentClass = wd.planDay
            ? dayAccentClass(wd.planDay.focus, wd.planDay.isRest)
            : wd.loggedWorkout?.activity_type
              ? dayAccentClass(wd.loggedWorkout.activity_type, false)
              : 'border-l-border/20'

          return (
            <button
              key={wd.date}
              onClick={() => setSelectedDay(wd)}
              className={cn(
                'rounded-xl border border-border bg-card border-l-2 p-4 flex flex-col gap-2 min-h-[140px] text-left',
                'hover:bg-muted/10 transition-colors cursor-pointer',
                accentClass,
                wd.status === 'rest' && 'opacity-50',
                wd.isToday && 'ring-1 ring-primary/30',
              )}
            >
              {/* Day header */}
              <div className="flex items-start justify-between gap-1">
                <div>
                  <p className={cn('text-xs font-semibold', wd.isToday && 'text-primary')}>
                    {wd.dayShort}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(wd.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot.color)} />
                  {dot.label && (
                    <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">
                      {dot.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Focus */}
              {wd.planDay && (
                <p className="text-xs font-medium text-foreground/80 leading-snug">{wd.planDay.focus}</p>
              )}
              {!wd.planDay && wd.loggedWorkout?.activity_type && (
                <p className="text-xs font-medium text-foreground/80 capitalize">{wd.loggedWorkout.activity_type}</p>
              )}

              {/* Running targets */}
              {wd.planDay?.runningTargets && (
                <div className="flex flex-wrap gap-1">
                  {wd.planDay.runningTargets.totalDistanceKm && (
                    <span className="text-[10px] font-medium text-blue-400">{wd.planDay.runningTargets.totalDistanceKm} km</span>
                  )}
                  {wd.planDay.runningTargets.segments
                    ? (() => {
                        const ivl = wd.planDay!.runningTargets!.segments!.find(s => s.type === 'intervals') as RunningSegmentIntervals | undefined
                        return ivl ? <span className="text-[10px] text-muted-foreground">{ivl.reps}×{ivl.repDistanceKm < 1 ? `${ivl.repDistanceKm * 1000}m` : `${ivl.repDistanceKm}km`}</span> : null
                      })()
                    : wd.planDay.runningTargets.paceMinPerKm && (
                        <span className="text-[10px] text-muted-foreground">{formatPace(wd.planDay.runningTargets.paceMinPerKm)} /km</span>
                      )
                  }
                </div>
              )}

              {/* Exercises preview */}
              {wd.planDay?.exercises && wd.planDay.exercises.length > 0 && (
                <div className="space-y-0.5">
                  {wd.planDay.exercises.slice(0, 3).map((ex, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground leading-tight truncate">
                      {ex.exerciseName} {ex.sets}×{ex.reps}
                    </p>
                  ))}
                  {wd.planDay.exercises.length > 3 && (
                    <p className="text-[10px] text-muted-foreground/50">+{wd.planDay.exercises.length - 3} more</p>
                  )}
                </div>
              )}

              {/* Logged chips */}
              {wd.loggedWorkout && (
                <div className="flex flex-wrap gap-1 mt-auto">
                  {wd.loggedWorkout.distance_km && (
                    <span className="text-[10px] bg-muted/60 rounded px-1.5 py-0.5 tabular-nums">
                      {wd.loggedWorkout.distance_km} km
                    </span>
                  )}
                  {wd.loggedWorkout.total_volume_kg && (
                    <span className="text-[10px] bg-muted/60 rounded px-1.5 py-0.5 tabular-nums">
                      {formatVolume(wd.loggedWorkout.total_volume_kg)} kg
                    </span>
                  )}
                </div>
              )}

              {/* Fallback description */}
              {wd.planDay && !wd.planDay.runningTargets &&
                (!wd.planDay.exercises || wd.planDay.exercises.length === 0) && (
                <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{wd.planDay.workout}</p>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Day detail modal ── */}
      {selectedDay && (
        <DayModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </section>
  )
}

// ─── Running targets block ────────────────────────────────────────────────────

function RunningTargetsBlock({ rt }: { rt: RunningTargets }) {
  const INTENSITY_LABEL: Record<string, string> = {
    easy: 'Easy', moderate: 'Moderate', tempo: 'Tempo',
    interval: 'Intervals', long_run: 'Long run', recovery: 'Recovery',
  }

  return (
    <div className="rounded-lg bg-blue-500/8 border border-blue-500/15 px-3.5 py-3 space-y-3">
      {/* Header row: intensity badge + total stats */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Running</p>
          {rt.intensityType && (
            <span className="text-[10px] font-medium bg-blue-500/15 text-blue-300 rounded px-1.5 py-0.5 capitalize">
              {INTENSITY_LABEL[rt.intensityType] ?? rt.intensityType.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
          {rt.totalDistanceKm && <span className="font-semibold text-foreground/80">{rt.totalDistanceKm} km</span>}
          {rt.totalDurationMinutes && <span>{formatDuration(rt.totalDurationMinutes)}</span>}
        </div>
      </div>

      {/* Description */}
      {rt.description && (
        <p className="text-xs text-foreground/70 leading-relaxed">{rt.description}</p>
      )}

      {/* Simple run: just show pace */}
      {!rt.segments && rt.paceMinPerKm && (
        <div className="flex items-center gap-3">
          <div>
            <p className="text-base font-semibold tabular-nums">{formatPace(rt.paceMinPerKm)} /km</p>
            <p className="text-[10px] text-muted-foreground">
              target pace{rt.paceKmPerH && <> · {rt.paceKmPerH} km/h</>}
            </p>
          </div>
        </div>
      )}

      {/* Structured session: segment breakdown */}
      {rt.segments && rt.segments.length > 0 && (
        <div className="space-y-1.5">
          {rt.segments.map((seg, i) => {
            if (seg.type === 'intervals') {
              const s = seg as RunningSegmentIntervals
              const repLabel = s.repDistanceKm < 1
                ? `${s.repDistanceKm * 1000}m`
                : `${s.repDistanceKm} km`
              const rest = s.restSeconds >= 60
                ? `${Math.round(s.restSeconds / 60)} min ${s.restType}`
                : `${s.restSeconds}s ${s.restType}`
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md bg-blue-500/10 px-2.5 py-2">
                  <div>
                    <p className="text-xs font-semibold text-blue-300">{s.reps}×{repLabel}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">rest: {rest}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold tabular-nums text-foreground/80">{formatPace(s.repPaceMinPerKm)} /km</p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">{Math.round(60 / s.repPaceMinPerKm * 10) / 10} km/h</p>
                  </div>
                </div>
              )
            }
            const s = seg as RunningSegmentWarmCool
            const typeLabel = s.type.charAt(0).toUpperCase() + s.type.slice(1)
            return (
              <div key={i} className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">{typeLabel}</span>
                  {s.distanceKm && <span className="text-xs text-foreground/60">{s.distanceKm} km</span>}
                  {s.durationMinutes && <span className="text-xs text-muted-foreground">{s.durationMinutes} min</span>}
                </div>
                {s.paceMinPerKm && (
                  <div className="text-right">
                    <p className="text-xs tabular-nums text-muted-foreground">{formatPace(s.paceMinPerKm)} /km</p>
                    <p className="text-[10px] tabular-nums text-muted-foreground/60">{Math.round(60 / s.paceMinPerKm * 10) / 10} km/h</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Day modal ────────────────────────────────────────────────────────────────

function DayModal({
  day,
  onClose,
}: {
  day: WeekDay
  onClose: () => void
}) {
  const { planDay, loggedWorkout, status } = day

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dot = statusDot(status)
  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div>
            <p className="text-base font-semibold">{dateLabel}</p>
            {planDay && <p className="text-sm text-muted-foreground mt-0.5">{planDay.focus}</p>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot.color)} />
            {dot.label && <span className="text-xs text-muted-foreground font-medium">{dot.label}</span>}
            <button
              onClick={onClose}
              className="ml-2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Planned workout ── */}
          {planDay && !planDay.isRest && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Planned</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{planDay.workout}</p>
              {planDay.duration && <p className="text-xs text-muted-foreground">{planDay.duration}</p>}

              {planDay.runningTargets && (
                <RunningTargetsBlock rt={planDay.runningTargets} />
              )}

              {planDay.exercises && planDay.exercises.length > 0 && (
                <div className="rounded-lg bg-orange-500/8 border border-orange-500/15 px-3.5 py-3 space-y-2">
                  <p className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Exercises</p>
                  <div className="divide-y divide-border/60">
                    {planDay.exercises.map((ex, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{ex.exerciseName}</p>
                          {ex.muscleGroups.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{ex.muscleGroups.join(', ')}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          <p className="text-foreground/80 font-medium">{ex.sets}×{ex.reps}</p>
                          <p>{ex.weightGuidance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Rest day ── */}
          {planDay?.isRest && (
            <p className="text-sm text-muted-foreground">Rest or active recovery day.</p>
          )}

          {/* ── Logged workout ── */}
          {loggedWorkout && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Logged</p>

              {loggedWorkout.raw_input && (
                <p className="text-sm text-foreground/80 italic leading-relaxed">&ldquo;{loggedWorkout.raw_input}&rdquo;</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {loggedWorkout.activity_type && <Chip>{loggedWorkout.activity_type}</Chip>}
                {loggedWorkout.duration_minutes && <Chip>{formatDuration(loggedWorkout.duration_minutes)}</Chip>}
                {loggedWorkout.distance_km && <Chip>{loggedWorkout.distance_km} km</Chip>}
                {loggedWorkout.pace_min_per_km && <Chip>{formatPace(loggedWorkout.pace_min_per_km)} /km</Chip>}
                {loggedWorkout.pace_km_per_h && <Chip>{loggedWorkout.pace_km_per_h} km/h</Chip>}
                {loggedWorkout.total_volume_kg && <Chip>{formatVolume(loggedWorkout.total_volume_kg)} kg vol</Chip>}
                {(() => {
                  const rpe = loggedWorkout.parsed_json?.perceivedEffort
                  return rpe ? <Chip>RPE {String(rpe)}/10</Chip> : null
                })()}
              </div>

              {loggedWorkout.exercises_json && loggedWorkout.exercises_json.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exercise</th>
                        <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sets×Reps</th>
                        <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Weight</th>
                        <th className="text-right px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loggedWorkout.exercises_json.map((ex, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-medium">{ex.exerciseName}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {ex.sets != null && ex.reps != null ? `${ex.sets}×${ex.reps}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {ex.weightKg != null ? `${ex.weightKg} kg` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-orange-400/80">
                            {ex.volumeKg != null ? formatVolume(ex.volumeKg) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Log CTA ── */}
          {!loggedWorkout && status !== 'rest' && (
            <Link
              href="/log"
              className="flex items-center justify-center w-full rounded-lg border border-dashed border-border/60 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              onClick={onClose}
            >
              + Log workout
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      {children}
    </span>
  )
}
