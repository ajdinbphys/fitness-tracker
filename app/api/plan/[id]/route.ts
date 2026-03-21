import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  // Verify ownership before deleting
  const { data: plan } = await serviceClient
    .from('plans')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await serviceClient
    .from('plans')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
