import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import {
  computeRunningWeek,
  computeLiftingWeek,
  formatPace,
  formatDuration,
  formatVolume,
  MUSCLE_GROUPS,
  type WorkoutRow,
  type HeatLevel,
} from '@/lib/metrics'
import WeekCalendar, { type Plan } from '@/components/week-calendar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HEAT_CLASS: Record<HeatLevel, string> = {
  none:   'bg-muted/20 text-muted-foreground/30',
  low:    'bg-primary/8  text-muted-foreground',
  medium: 'bg-primary/20 text-foreground/70',
  high:   'bg-primary/45 text-foreground',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
      {children}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: plans }, { data: allWeekWorkouts }] = await Promise.all([
    serviceClient
      .from('plans').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1),
    serviceClient
      .from('workouts')
      .select('id, logged_at, activity_type, duration_minutes, distance_km, pace_min_per_km, pace_km_per_h, exercises_json, total_volume_kg, raw_input, parsed_json')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgo)
      .order('logged_at', { ascending: false }),
  ])

  const plan: Plan | null = plans?.[0] ?? null
  const weekWorkouts: WorkoutRow[] = (allWeekWorkouts ?? []) as WorkoutRow[]
  const recentWorkouts = weekWorkouts.slice(0, 6)

  const runningSummary = computeRunningWeek(weekWorkouts)
  const liftingSummary = computeLiftingWeek(weekWorkouts)
  const hasWeeklyData = runningSummary !== null || liftingSummary !== null

  // Pre-fetch plan week workouts so the calendar renders without a loading flicker
  let planWeekWorkouts: WorkoutRow[] = []
  if (plan) {
    const planStart = new Date(plan.week_start_date + 'T00:00:00')
    const planEnd = new Date(planStart)
    planEnd.setDate(planEnd.getDate() + 7)
    const { data: pw } = await serviceClient
      .from('workouts').select('*').eq('user_id', user.id)
      .gte('logged_at', planStart.toISOString())
      .lt('logged_at', planEnd.toISOString())
      .order('logged_at', { ascending: true })
    planWeekWorkouts = (pw ?? []) as WorkoutRow[]
  }

  return (
    <div className="space-y-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Overview</p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <Link href="/log" className={cn(buttonVariants({ size: 'sm' }))}>
          + Log workout
        </Link>
      </div>

      {/* ── No plan ── */}
      {!plan ? (
        <div className="rounded-xl border border-border bg-card px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-5">You don&apos;t have a training plan yet.</p>
          <Link href="/onboarding" className={cn(buttonVariants())}>Create your plan</Link>
        </div>
      ) : (
        <>
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
                      {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                <Link
                  href="/onboarding"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  New plan →
                </Link>
              </div>
            </div>
          </div>

          {/* ── Weekly plan calendar ── */}
          <WeekCalendar plan={plan} initialWorkouts={planWeekWorkouts} />

          {/* ── Coaching tips ── */}
          {plan.plan_json.tips?.length > 0 && (
            <section>
              <SectionLabel>Coaching tips</SectionLabel>
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
        </>
      )}

      {/* ── Weekly training metrics ── */}
      {hasWeeklyData && (
        <section>
          <SectionLabel>This week&apos;s training</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">

            {/* Running summary */}
            {runningSummary && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">Running</p>
                  <span className="text-xs text-muted-foreground ml-auto">{runningSummary.sessions} session{runningSummary.sessions > 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{runningSummary.totalDistanceKm}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">km total</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{formatDuration(runningSummary.totalDurationMinutes)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">time</p>
                  </div>
                  {runningSummary.avgPaceMinPerKm && (
                    <div>
                      <p className="text-xl font-semibold tabular-nums">{formatPace(runningSummary.avgPaceMinPerKm)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        avg /km
                        {runningSummary.avgPaceKmPerH && (
                          <> · {runningSummary.avgPaceKmPerH} km/h</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lifting summary */}
            {liftingSummary && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <p className="text-sm font-medium">Strength</p>
                  <span className="text-xs text-muted-foreground ml-auto">{liftingSummary.sessions} session{liftingSummary.sessions > 1 ? 's' : ''}</span>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{formatVolume(liftingSummary.totalVolumeKg)} kg</p>
                  <p className="text-xs text-muted-foreground mt-0.5">total volume lifted</p>
                </div>
                {/* Top muscle groups by volume */}
                <div className="space-y-1.5">
                  {liftingSummary.muscleGroups
                    .filter(m => m.volumeKg > 0)
                    .slice(0, 4)
                    .map(m => (
                      <div key={m.key} className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground w-20 shrink-0">{m.label}</p>
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500/60 rounded-full"
                            style={{
                              width: `${Math.round((m.volumeKg / liftingSummary.totalVolumeKg) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">
                          {formatVolume(m.volumeKg)} kg
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 w-10 text-right">
                          {m.frequency}×/wk
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Muscle group heatmap */}
          {liftingSummary && (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
                Muscle balance
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-1.5">
                {MUSCLE_GROUPS.map(({ key, label }) => {
                  const stat = liftingSummary.muscleGroups.find(m => m.key === key)
                  const level: HeatLevel = stat?.level ?? 'none'
                  return (
                    <div
                      key={key}
                      className={cn(
                        'rounded-lg px-2 py-2.5 text-center transition-colors',
                        HEAT_CLASS[level]
                      )}
                      title={stat?.volumeKg ? `${formatVolume(stat.volumeKg)} kg · ${stat.frequency}×/wk` : 'Not trained'}
                    >
                      <p className="text-[10px] font-medium leading-tight">{label}</p>
                      {stat && stat.volumeKg > 0 ? (
                        <p className="text-[9px] mt-0.5 opacity-70 tabular-nums">
                          {stat.frequency}×
                        </p>
                      ) : (
                        <p className="text-[9px] mt-0.5 opacity-30">—</p>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3">
                {(['none', 'low', 'medium', 'high'] as HeatLevel[]).map(level => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className={cn('h-2.5 w-2.5 rounded-sm', HEAT_CLASS[level])} />
                    <span className="text-[10px] text-muted-foreground capitalize">{level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Recent workouts ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Recent workouts</SectionLabel>
          <Link href="/log" className="text-xs text-muted-foreground hover:text-foreground transition-colors -mt-4">
            View all →
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-4">No workouts logged yet.</p>
            <Link href="/log" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Log your first workout
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentWorkouts.map((w: WorkoutRow) => (
              <div key={w.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug truncate">{w.raw_input}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {w.activity_type && <StatChip>{w.activity_type}</StatChip>}
                    {w.duration_minutes && <StatChip>{w.duration_minutes} min</StatChip>}
                    {w.distance_km && <StatChip>{w.distance_km} km</StatChip>}
                    {w.pace_min_per_km && (
                      <StatChip>{formatPace(w.pace_min_per_km)} /km</StatChip>
                    )}
                    {w.pace_km_per_h && (
                      <StatChip>{w.pace_km_per_h} km/h</StatChip>
                    )}
                    {w.total_volume_kg && (
                      <StatChip>{formatVolume(w.total_volume_kg)} kg vol</StatChip>
                    )}
                    {(() => {
                      const rpe = (w.parsed_json as Record<string, unknown> | null)?.perceivedEffort
                      return rpe ? <StatChip>RPE {String(rpe)}/10</StatChip> : null
                    })()}
                  </div>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground pt-0.5">
                  {new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
