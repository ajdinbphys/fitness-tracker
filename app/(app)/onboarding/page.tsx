'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
type FitnessLevel = typeof FITNESS_LEVELS[number]

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const

export default function OnboardingPage() {
  const router = useRouter()
  const [goal, setGoal] = useState('')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'generating'>('form')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!goal.trim() || !fitnessLevel || !daysPerWeek) return

    setError('')
    setStep('generating')

    // Step 1: validate goal
    const validateRes = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    })
    const validateData = await validateRes.json()

    if (!validateData.valid) {
      setError(validateData.message ?? 'This goal does not appear to be fitness-related.')
      setStep('form')
      return
    }

    // Step 2: generate plan
    const generateRes = await fetch('/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, fitnessLevel, daysPerWeek }),
    })
    const generateData = await generateRes.json()

    if (!generateRes.ok) {
      setError(generateData.error ?? 'Failed to generate plan. Please try again.')
      setStep('form')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to FitLog</CardTitle>
          <CardDescription>
            Tell us about your fitness goal and we&apos;ll build a personalized weekly plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'generating' ? (
            <div className="text-center py-12 space-y-4">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
              <p className="text-muted-foreground">
                Validating your goal and generating your plan...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="goal">What&apos;s your fitness goal?</Label>
                <Textarea
                  id="goal"
                  placeholder="e.g. I want to run a half marathon under 2 hours, the race is in 6 weeks"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  rows={3}
                  required
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Be specific — include timeframes, distances, or targets if you have them
                </p>
              </div>

              <div className="space-y-3">
                <Label>Current fitness level</Label>
                <div className="flex gap-2">
                  {FITNESS_LEVELS.map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFitnessLevel(level)}
                      className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors capitalize ${
                        fitnessLevel === level
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Days available per week</Label>
                <div className="flex gap-2">
                  {DAYS_OPTIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysPerWeek(d)}
                      className={`w-10 h-10 rounded-md border text-sm font-medium transition-colors ${
                        daysPerWeek === d
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!goal.trim() || !fitnessLevel || !daysPerWeek}
              >
                Generate my plan
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
