import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import PlanCard from './plan-card'

interface PlanJson {
  summary: string
  totalWeeks?: number
  weeklyPlan: { date?: string }[]
}

interface Plan {
  id: string
  goal: string
  plan_json: PlanJson
  week_start_date: string
  created_at: string
}

function isPast(plan: Plan): boolean {
  const totalWeeks = plan.plan_json.totalWeeks ?? 1
  const end = new Date(plan.week_start_date + 'T00:00:00')
  end.setDate(end.getDate() + totalWeeks * 7)
  return end < new Date()
}

export default async function PlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const plans: Plan[] = (data ?? []) as Plan[]
  const active = plans.filter(p => !isPast(p))
  const past = plans.filter(p => isPast(p))

  return (
    <div className="space-y-10 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">Plans</p>
          <h1 className="text-2xl font-semibold tracking-tight">Training plans</h1>
        </div>
        <Link href="/onboarding" className={cn(buttonVariants({ size: 'sm' }))}>
          + New plan
        </Link>
      </div>

      {plans.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-5">No training plans yet.</p>
          <Link href="/onboarding" className={cn(buttonVariants())}>Create your first plan</Link>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Active</p>
          {active.map(plan => <PlanCard key={plan.id} plan={plan} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Past</p>
          {past.map(plan => <PlanCard key={plan.id} plan={plan} />)}
        </section>
      )}
    </div>
  )
}
