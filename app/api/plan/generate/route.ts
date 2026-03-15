import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { goal, fitnessLevel, daysPerWeek } = await req.json()

  if (!goal || !fitnessLevel || !daysPerWeek) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a personal fitness coach. Create a structured weekly training plan based on the user's goal.

Goal: ${goal}
Fitness level: ${fitnessLevel}
Available days per week: ${daysPerWeek}

Return JSON only, no markdown, no preamble. Use this exact structure:
{
  "summary": "<1-2 sentence overview of the plan>",
  "weeklyPlan": [
    {
      "day": "Monday",
      "focus": "<e.g. Rest, Running, Strength - Upper Body>",
      "workout": "<detailed description of what to do>",
      "duration": "<e.g. 45 minutes>",
      "isRest": false
    }
  ],
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Include exactly 7 days (Monday through Sunday). Mark rest days with isRest: true and a short recovery description in workout. Tailor intensity and volume to the fitness level.`,
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
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday

  const { data, error } = await serviceClient
    .from('plans')
    .insert({
      user_id: user.id,
      goal,
      plan_json: planJson,
      week_start_date: weekStart.toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
  }

  return NextResponse.json({ plan: data })
}
