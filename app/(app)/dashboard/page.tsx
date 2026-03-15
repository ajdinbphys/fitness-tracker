import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/lib/button-variants'
import { Separator } from '@/components/ui/separator'
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const serviceClient = createServiceClient()

  const [{ data: plans }, { data: workouts }] = await Promise.all([
    serviceClient
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    serviceClient
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(5),
  ])

  const currentPlan: Plan | null = plans?.[0] ?? null
  const recentWorkouts: Workout[] = workouts ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your weekly training overview</p>
        </div>
        <Link href="/log" className={cn(buttonVariants({ variant: 'outline' }))}>
          Log workout
        </Link>
      </div>

      {!currentPlan ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">No training plan yet.</p>
            <Link href="/onboarding" className={cn(buttonVariants())}>
              Create your plan
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Plan summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Goal</CardTitle>
              <CardDescription>{currentPlan.goal}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{currentPlan.plan_json.summary}</p>
            </CardContent>
          </Card>

          {/* Weekly plan grid */}
          <div>
            <h2 className="font-semibold mb-3">This Week</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {currentPlan.plan_json.weeklyPlan.map((day) => (
                <Card key={day.day} className={day.isRest ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">{day.day}</CardTitle>
                        {day.date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <Badge variant={day.isRest ? 'secondary' : 'outline'} className="text-xs">
                        {day.isRest ? 'Rest' : day.duration}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-medium text-foreground/70">
                      {day.focus}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">{day.workout}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Tips */}
          {currentPlan.plan_json.tips?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coaching tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {currentPlan.plan_json.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-foreground font-medium">{i + 1}.</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Separator />

      {/* Recent workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Workouts</h2>
          <Link href="/log" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            View all
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-sm">No workouts logged yet.</p>
              <Link href="/log" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
                Log your first workout
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map((w) => (
              <Card key={w.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{w.raw_input}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {w.activity_type && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {w.activity_type}
                          </Badge>
                        )}
                        {w.duration_minutes && (
                          <Badge variant="outline" className="text-xs">
                            {w.duration_minutes} min
                          </Badge>
                        )}
                        {w.parsed_json?.distance && (
                          <Badge variant="outline" className="text-xs">
                            {w.parsed_json.distance}
                          </Badge>
                        )}
                        {w.parsed_json?.perceivedEffort && (
                          <Badge variant="outline" className="text-xs">
                            RPE {w.parsed_json.perceivedEffort}/10
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(w.logged_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
