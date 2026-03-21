import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const start = req.nextUrl.searchParams.get('start')
  if (!start) return NextResponse.json({ error: 'Missing start param' }, { status: 400 })

  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', startDate.toISOString())
    .lt('logged_at', endDate.toISOString())
    .order('logged_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch workouts' }, { status: 500 })

  return NextResponse.json({ workouts: data })
}
