import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawInput, logDate: newLogDate } = await req.json()
  if (!rawInput || typeof rawInput !== 'string') {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Verify ownership and get original logged_at date
  const { data: existing } = await serviceClient
    .from('workouts')
    .select('id, logged_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Use explicitly provided date, or fall back to the existing logged_at date
  const validNewDate = typeof newLogDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(newLogDate)
  const logDate = validNewDate ? newLogDate : existing.logged_at.split('T')[0]
  const logged_at = validNewDate ? new Date(newLogDate + 'T12:00:00').toISOString() : existing.logged_at

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a fitness workout parser. Extract structured data from the user's free-text log.

Today's date: ${logDate}
User's log: "${rawInput}"

Return JSON only, no markdown, no preamble. Use exactly this structure:
{
  "activityType": "running|cycling|swimming|strength|yoga|mixed|other",
  "durationMinutes": <number or null>,
  "perceivedEffort": <1-10 or null>,
  "date": "<YYYY-MM-DD, today if not stated>",
  "notes": "<mood, conditions, injuries, PBs, anything else>",
  "running": {
    "distanceKm": <decimal km or null>,
    "paceMinPerKm": <decimal — e.g. 6.5 means 6:30/km — calculate from distance÷duration if both given, else null>,
    "paceKmPerH": <decimal — calculate as 60 ÷ paceMinPerKm when pace is known, else null>
  },
  "exercises": [
    {
      "exerciseName": "<full name, e.g. Barbell Bench Press>",
      "muscleGroups": ["<primary>", "<secondary — up to 3 total>"],
      "sets": <number or null>,
      "reps": <reps per set or null>,
      "weightKg": <kg or null>,
      "volumeKg": <sets × reps × weightKg, calculated, or null if any factor missing>
    }
  ],
  "totalVolumeKg": <sum of all exercises' volumeKg or null>
}

Rules:
- Running/cycling/swimming: populate running fields. paceMinPerKm = durationMinutes / distanceKm. paceKmPerH = 60 / paceMinPerKm.
- Strength/lifting: populate exercises. muscleGroups must use ONLY these: chest, back, shoulders, biceps, triceps, forearms, core, quads, hamstrings, glutes, calves. volumeKg = sets × reps × weightKg.
- Non-running: set running to { "distanceKm": null, "paceMinPerKm": null, "paceKmPerH": null }.
- Non-lifting: set exercises to [] and totalVolumeKg to null.
- Effort: easy/recovery=3-4, moderate/steady=5-6, hard/challenging=7-8, all-out/PB=9-10, tired/sluggish=3-5.`,
      },
    ],
  })

  const text = (message.content[0] as { type: string; text: string }).text.trim()
  let parsedJson: Record<string, unknown>
  try {
    parsedJson = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse workout data' }, { status: 500 })
  }

  const running = parsedJson.running as {
    distanceKm?: number | null
    paceMinPerKm?: number | null
    paceKmPerH?: number | null
  } | null

  const exercises = Array.isArray(parsedJson.exercises) ? parsedJson.exercises : []
  const totalVolumeKg = typeof parsedJson.totalVolumeKg === 'number' ? parsedJson.totalVolumeKg : null

  const durationMinutes = typeof parsedJson.durationMinutes === 'number'
    ? parsedJson.durationMinutes
    : (running?.distanceKm && running?.paceMinPerKm)
      ? Math.round(running.distanceKm * running.paceMinPerKm)
      : null

  const { data, error } = await serviceClient
    .from('workouts')
    .update({
      raw_input: rawInput,
      parsed_json: parsedJson,
      logged_at,
      activity_type: (parsedJson.activityType as string) ?? null,
      duration_minutes: durationMinutes,
      notes: (parsedJson.notes as string) ?? null,
      distance_km: running?.distanceKm ?? null,
      pace_min_per_km: running?.paceMinPerKm ?? null,
      pace_km_per_h: running?.paceKmPerH ?? null,
      exercises_json: exercises.length > 0 ? exercises : null,
      total_volume_kg: totalVolumeKg,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Supabase update error:', error)
    return NextResponse.json({ error: 'Failed to update workout' }, { status: 500 })
  }

  return NextResponse.json({ workout: data, parsed: parsedJson })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceClient()

  const { data: existing } = await serviceClient
    .from('workouts')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await serviceClient.from('workouts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
