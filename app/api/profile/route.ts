import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('profiles')
    .select('sex, date_of_birth, height_cm, weight_kg')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ profile: data ?? null })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sex, dateOfBirth, heightCm, weightKg } = body

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from('profiles')
    .upsert({
      user_id: user.id,
      sex: sex ?? undefined,
      date_of_birth: dateOfBirth ?? undefined,
      height_cm: heightCm ?? undefined,
      weight_kg: weightKg ?? undefined,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
