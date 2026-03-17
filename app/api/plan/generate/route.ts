import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function calcAge(dateOfBirth: string): number {
  return Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goal, fitnessLevel, daysPerWeek, profile, planStartDate } = await req.json()
  if (!goal || !fitnessLevel || !daysPerWeek) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Save profile
  if (profile) {
    const serviceClient = createServiceClient()
    await serviceClient.from('profiles').upsert({
      user_id: user.id,
      sex: profile.sex,
      date_of_birth: profile.dateOfBirth,
      height_cm: profile.heightCm,
      weight_kg: profile.weightKg,
    }, { onConflict: 'user_id' })
  }

  const profileContext = profile
    ? `User profile:
- Sex: ${profile.sex}
- Age: ${calcAge(profile.dateOfBirth)} years old
- Height: ${profile.heightCm} cm
- Weight: ${profile.weightKg} kg`
    : ''

  const weekStartDate = planStartDate ?? new Date().toISOString().split('T')[0]

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: `You are a personal fitness coach. Create a full multi-week training plan.

${profileContext}

Goal: ${goal}
Fitness level: ${fitnessLevel}
Available training days: ${daysPerWeek} per week
Plan start date: ${weekStartDate}

Determine the total number of weeks from the goal (e.g. "race in 20 weeks" → 20 weeks). If no duration is mentioned, use 4 weeks.

Factor in the user's age, sex, height, and weight when choosing weights, distances, and intensities. Progress the plan week-over-week (increase mileage, volume, or intensity gradually).

Return JSON only, no markdown, no preamble. Use exactly this structure:
{
  "summary": "<1-2 sentence overview>",
  "totalWeeks": <number>,
  "weekStartDate": "${weekStartDate}",
  "weeklyPlan": [
    {
      "week": <week number, 1-based>,
      "day": "<day name e.g. Monday>",
      "date": "<YYYY-MM-DD>",
      "focus": "<e.g. Easy Run, Rest, Strength — Upper Body>",
      "workout": "<plain-English description, 1 sentence>",
      "duration": "<e.g. 40 min>",
      "isRest": <true|false>,
      "runningTargets": <null for non-running days, or:> {
        "totalDistanceKm": <number>,
        "totalDurationMinutes": <number>,
        "paceMinPerKm": <overall avg pace, null for interval days>,
        "paceKmPerH": <overall avg speed, null for interval days>,
        "intensityType": "easy|moderate|tempo|interval|long_run|recovery",
        "description": "<1-sentence summary e.g. '6×800m at 5K pace with jog recovery'>",
        "segments": <null for simple runs; for structured sessions, array of:> [
          { "type": "warmup",    "distanceKm": <n>, "durationMinutes": <n>, "paceMinPerKm": <n> },
          { "type": "intervals", "reps": <n>, "repDistanceKm": <n>, "repPaceMinPerKm": <n>, "restSeconds": <n>, "restType": "jog|walk|standing" },
          { "type": "tempo",     "distanceKm": <n>, "durationMinutes": <n>, "paceMinPerKm": <n> },
          { "type": "cooldown",  "distanceKm": <n>, "durationMinutes": <n>, "paceMinPerKm": <n> }
        ]
      },
      "exercises": <[] or [{ "exerciseName": "<name>", "muscleGroups": ["<g>"], "sets": <n>, "reps": <n>, "weightGuidance": "<guidance>" }]>
    }
  ],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Rules:
- weeklyPlan must contain exactly totalWeeks × 7 entries, one per calendar day, consecutive from ${weekStartDate}.
- Mark rest days with isRest: true, runningTargets: null, exercises: [].
- Running days: populate runningTargets. Leave exercises: [].
- Strength days: list 3-5 exercises. Leave runningTargets: null.
- muscleGroups must use only: chest, back, shoulders, biceps, triceps, forearms, core, quads, hamstrings, glutes, calves.
- Keep workout field to 1 sentence. Put detail in runningTargets.description and segments.
- Use segments for interval, tempo, and fartlek sessions. Null for easy/long runs.
- Progress load/mileage each week by ~5-10%.`,
      },
    ],
  })

  const text = (message.content[0] as { type: string; text: string }).text.trim()
  let planJson
  try {
    planJson = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan from AI' }, { status: 500 })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('plans')
    .insert({
      user_id: user.id,
      goal,
      plan_json: planJson,
      week_start_date: weekStartDate,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
  }

  return NextResponse.json({ plan: data })
}
