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

  const { rawInput } = await req.json()

  if (!rawInput || typeof rawInput !== 'string') {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are a fitness log parser. Extract structured workout data from the user's free-text log entry.

Today's date: ${today}

User's log: "${rawInput}"

Return JSON only, no markdown, no preamble. Use this exact structure:
{
  "activityType": "<e.g. running, cycling, strength, yoga, swimming, mixed>",
  "durationMinutes": <number or null if not mentioned>,
  "distance": "<e.g. '5km' or null>",
  "perceivedEffort": <number 1-10 or null if not mentioned>,
  "date": "<YYYY-MM-DD, assume today if not stated>",
  "exercises": [
    { "name": "<exercise name>", "sets": <number or null>, "reps": <number or null>, "weight": "<e.g. '80kg' or null>" }
  ],
  "notes": "<any other relevant info like mood, conditions, injuries>"
}

If no exercises were mentioned, return exercises as an empty array. Be generous in interpreting effort — words like "tired" suggest lower effort (3-4), "felt good" suggests moderate-high (6-7), "crushed it" suggests high (8-9).`,
      },
    ],
  })

  const text = (message.content[0] as { type: string; text: string }).text.trim()

  let parsedJson
  try {
    parsedJson = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse workout data' }, { status: 500 })
  }

  const serviceClient = createServiceClient()

  const { data, error } = await serviceClient
    .from('workouts')
    .insert({
      user_id: user.id,
      raw_input: rawInput,
      parsed_json: parsedJson,
      activity_type: parsedJson.activityType ?? null,
      duration_minutes: parsedJson.durationMinutes ?? null,
      notes: parsedJson.notes ?? null,
      logged_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 })
  }

  return NextResponse.json({ workout: data, parsed: parsedJson })
}
