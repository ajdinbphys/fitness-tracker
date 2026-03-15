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
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a personal fitness coach. Create a detailed weekly training plan.

${profileContext}

Goal: ${goal}
Fitness level: ${fitnessLevel}
Available training days: ${daysPerWeek} per week
Plan start date: ${weekStartDate}

Factor in the user's age, sex, height, and weight when choosing weights, distances, and intensities.

Return JSON only, no markdown, no preamble. Use exactly this structure:
{
  "summary": "<1-2 sentence overview>",
  "weekStartDate": "${weekStartDate}",
  "weeklyPlan": [
    {
      "day": "<day name e.g. Monday>",
      "date": "<YYYY-MM-DD>",
      "focus": "<e.g. Easy Run, Rest, Strength — Upper Body>",
      "workout": "<plain-English description of the full session>",
      "duration": "<e.g. 40 minutes>",
      "isRest": <true|false>,

      "runningTargets": <null for non-running days, or:> {
        "distanceKm": <number>,
        "durationMinutes": <number>,
        "paceMinPerKm": <decimal e.g. 6.5 for 6:30/km>,
        "paceKmPerH": <decimal e.g. 9.2>,
        "intensityType": "easy|moderate|tempo|interval|long_run|recovery"
      },

      "exercises": <[] for non-lifting days, or array of:> [
        {
          "exerciseName": "<full name>",
          "muscleGroups": ["<primary>", "<secondary>"],
          "sets": <number>,
          "reps": <number>,
          "weightGuidance": "<e.g. '70% of 1RM' or '~60 kg for intermediate' or 'bodyweight'>"
        }
      ]
    }
  ],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Rules:
- Include exactly 7 consecutive days starting from ${weekStartDate}.
- Mark rest/active-recovery days with isRest: true, set runningTargets: null, exercises: [].
- For running days: set runningTargets with realistic targets for this fitness level. Leave exercises: [].
- For strength days: list 4-6 exercises with sets, reps, and weight guidance. Leave runningTargets: null.
- muscleGroups must use only: chest, back, shoulders, biceps, triceps, forearms, core, quads, hamstrings, glutes, calves.
- For mixed cardio+strength days: populate both runningTargets and exercises.
- Tailor all numbers to the user's profile and fitness level.`,
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
