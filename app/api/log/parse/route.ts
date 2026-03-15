import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rawInput } = await req.json()
  if (!rawInput || typeof rawInput !== 'string') {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a fitness workout parser. Extract structured data from the user's free-text log.

Today's date: ${today}
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

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('workouts')
    .insert({
      user_id: user.id,
      raw_input: rawInput,
      parsed_json: parsedJson,
      activity_type: (parsedJson.activityType as string) ?? null,
      duration_minutes: (parsedJson.durationMinutes as number) ?? null,
      notes: (parsedJson.notes as string) ?? null,
      logged_at: new Date().toISOString(),
      // Running metrics
      distance_km: running?.distanceKm ?? null,
      pace_min_per_km: running?.paceMinPerKm ?? null,
      pace_km_per_h: running?.paceKmPerH ?? null,
      // Lifting metrics
      exercises_json: exercises.length > 0 ? exercises : null,
      total_volume_kg: totalVolumeKg,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 })
  }

  return NextResponse.json({ workout: data, parsed: parsedJson })
}
