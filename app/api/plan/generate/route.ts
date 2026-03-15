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

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { goal, fitnessLevel, daysPerWeek, profile, planStartDate } = await req.json()

  if (!goal || !fitnessLevel || !daysPerWeek) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Save profile to Supabase (upsert so re-onboarding works)
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

  // Build profile context string for Claude
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
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a personal fitness coach. Create a structured weekly training plan based on the user's goal and profile.

${profileContext}

Goal: ${goal}
Fitness level: ${fitnessLevel}
Available days per week: ${daysPerWeek}
Plan start date: ${weekStartDate}

Factor in the user's age, sex, height, and weight when setting intensity, volume, and recovery recommendations. Use the plan start date to label the days correctly (the first day of the plan is ${weekStartDate}).

Return JSON only, no markdown, no preamble. Use this exact structure:
{
  "summary": "<1-2 sentence overview of the plan>",
  "weekStartDate": "${weekStartDate}",
  "weeklyPlan": [
    {
      "day": "<day name, e.g. Monday>",
      "date": "<YYYY-MM-DD>",
      "focus": "<e.g. Rest, Running, Strength - Upper Body>",
      "workout": "<detailed description of what to do>",
      "duration": "<e.g. 45 minutes>",
      "isRest": false
    }
  ],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Include exactly 7 consecutive days starting from the plan start date. Mark rest days with isRest: true. Tailor intensity and volume to the fitness level and user profile.`,
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
