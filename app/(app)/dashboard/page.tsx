import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'

interface DayPlan {
  day: string
  date?: string
  focus: string
  workout: string
  duration: string
  isRest: boolean
}

interface PlanJson {
  summary: string
  weeklyPlan: DayPlan[]
  tips: string[]
}

interface Plan {
  id: string
  goal: string
  plan_json: PlanJson
  week_start_date: string
  created_at: string
}

interface Workout {
  id: string
  raw_input: string
  activity_type: string | null
  duration_minutes: number | null
  logged_at: string
  parsed_json: {
    perceivedEffort?: number | null
    distance?: string | null
  }
}

/** Left-border accent colour based on activity focus */
function dayBorderColor(focus: string, isRest: boolean) {
  if (isRest) return 'border-l-border'
  const f = focus.toLowerCase()
  if (f.includes('run') || f.includes('cardio') || f.includes('cycl') || f.includes('swim'))
    return 'border-l-blue-500'
  if (
    f.includes('strength') || f.includes('gym') || f.includes('upper') ||
    f.includes('lower') || f.includes('push') || f.includes('pull') || f.includes('leg')
  )
    return 'border-l-orange-500'
  if (f.includes('yoga') || f.includes('flex') || f.includes('mobil') || f.includes('stretch'))
    return 'border-l-emerald-500'
  return 'border-l-primary'
}

function WorkoutChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      {children}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const [{ data: plans }, { data: workouts }] = await Promise.all([
    serviceClient
      .from('plans').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1),
    serviceClient
      .from('workouts').select('*').eq('user_id', user.id)
      .order('logged_at', { ascending: false }).limit(6),
  ])

  const plan: Plan | null = plans?.[0] ?? null
  const recentWorkouts: Workout[] = workouts ?? []

  return (
    <div className="space-y-12">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
            Overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <Link href="/log" className={cn(buttonVariants({ size: 'sm' }))}>
          + Log workout
        </Link>
      </div>

      {/* ── No plan state ── */}
      {!plan ? (
        <div className="rounded-xl border border-border bg-card px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-5">
            You don&apos;t have a training plan yet.
          </p>
          <Link href="/onboarding" className={cn(buttonVariants())}>
            Create your plan
          </Link>
        </div>
      ) : (
        <>
          {/* ── Goal banner ── */}
          <div className="rounded-xl border border-border bg-card px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                  Current goal
                </p>
                <p className="text-base font-medium text-foreground leading-snug">
                  {plan.goal}
                </p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {plan.plan_json.summary}
                </p>
              </div>
              {plan.week_start_date && (
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {new Date(plan.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Weekly plan ── */}
          <section>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
              This week
            </p>

            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {plan.plan_json.weeklyPlan.map((day) => (
                <div
                  key={day.day}
                  className={cn(
                    'rounded-xl border border-border bg-card border-l-2 p-4 flex flex-col gap-2',
                    dayBorderColor(day.focus, day.isRest),
                    day.isRest && 'opacity-50'
                  )}
                >
                  {/* Day + date */}
                  <div>
                    <p className="text-xs font-semibold text-foreground">{day.day}</p>
                    {day.date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  {/* Focus tag */}
                  <p className="text-xs font-medium text-foreground/80">{day.focus}</p>

                  {/* Workout description */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                    {day.workout}
                  </p>

                  {/* Duration */}
                  {!day.isRest && day.duration && (
                    <p className="text-[10px] font-medium text-muted-foreground/70 mt-auto">
                      {day.duration}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Coaching tips ── */}
          {plan.plan_json.tips?.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
                Coaching tips
              </p>
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

      {/* ── Recent workouts ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Recent workouts
          </p>
          <Link
            href="/log"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
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
            {recentWorkouts.map((w) => (
              <div key={w.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug truncate">{w.raw_input}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {w.activity_type && (
                      <WorkoutChip>{w.activity_type}</WorkoutChip>
                    )}
                    {w.duration_minutes && (
                      <WorkoutChip>{w.duration_minutes} min</WorkoutChip>
                    )}
                    {w.parsed_json?.distance && (
                      <WorkoutChip>{w.parsed_json.distance}</WorkoutChip>
                    )}
                    {w.parsed_json?.perceivedEffort && (
                      <WorkoutChip>RPE {w.parsed_json.perceivedEffort}/10</WorkoutChip>
                    )}
                  </div>
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
