import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('weight_logs')
    .select('id, logged_date, weight_kg')
    .eq('user_id', user.id)
    .gte('logged_date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('logged_date', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  return NextResponse.json({ logs: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, weightKg } = await req.json()
  if (!date || weightKg == null) {
    return NextResponse.json({ error: 'date and weightKg are required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('weight_logs')
    .upsert(
      { user_id: user.id, logged_date: date, weight_kg: weightKg },
      { onConflict: 'user_id,logged_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  return NextResponse.json({ log: data })
}
