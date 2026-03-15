import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { goal } = await req.json()

  if (!goal || typeof goal !== 'string') {
    return NextResponse.json({ error: 'goal is required' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are a fitness goal validator for an app called FitLog that helps users track gym workouts and running.

Determine whether the following goal is a genuine fitness goal. Fitness goals include: running, cycling, swimming, gym training, weight loss, muscle gain, flexibility, sport-specific training, endurance improvement, strength improvement, or any other physical exercise goal.

If the goal is not fitness-related at all (e.g. "I want to learn Spanish" or "I want to get better at cooking"), reject it.

Respond with JSON only, no markdown, no preamble. Use one of these two formats:
{"valid": true}
{"valid": false, "message": "<short friendly message explaining FitLog is only for fitness goals>"}

Goal: ${goal}`,
      },
    ],
  })

  const text = (message.content[0] as { type: string; text: string }).text.trim()

  try {
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ valid: true })
  }
}
