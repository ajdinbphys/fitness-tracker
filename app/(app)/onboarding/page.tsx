'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
type FitnessLevel = typeof FITNESS_LEVELS[number]

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const

/** Returns the date string (YYYY-MM-DD) for the coming Monday */
function nextMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0 = Sun, 1 = Mon …
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

export default function OnboardingPage() {
  const router = useRouter()

  // ── Step 1: profile ──
  const [sex, setSex] = useState<'male' | 'female' | ''>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [planStartDate, setPlanStartDate] = useState(nextMonday())

  // ── Step 2: goal ──
  const [goal, setGoal] = useState('')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)

  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  const profileComplete =
    sex !== '' && dateOfBirth !== '' && heightCm !== '' && weightKg !== '' && planStartDate !== ''

  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault()
    if (!profileComplete) return
    setError('')
    setCurrentStep(2)
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!goal.trim() || !fitnessLevel || !daysPerWeek) return

    setError('')
    setGenerating(true)

    // Step 1: validate goal
    const validateRes = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    })
    const validateData = await validateRes.json()

    if (!validateData.valid) {
      setError(validateData.message ?? 'This goal does not appear to be fitness-related.')
      setGenerating(false)
      return
    }

    // Step 2: generate plan
    const generateRes = await fetch('/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        fitnessLevel,
        daysPerWeek,
        profile: {
          sex,
          dateOfBirth,
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
        },
        planStartDate,
      }),
    })
    const generateData = await generateRes.json()

    if (!generateRes.ok) {
      setError(generateData.error ?? 'Failed to generate plan. Please try again.')
      setGenerating(false)
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
            {currentStep === 1
              ? 'First, tell us a bit about yourself'
              : "Now tell us your goal and we'll build your plan"}
          </CardDescription>
          {/* step indicator */}
          <div className="flex justify-center gap-2 pt-2">
            {[1, 2].map(s => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  s <= currentStep ? 'bg-black' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {generating ? (
            <div className="text-center py-12 space-y-4">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
              <p className="text-muted-foreground">
                Validating your goal and generating your plan...
              </p>
            </div>
          ) : currentStep === 1 ? (
            /* ── Step 1: Profile ── */
            <form onSubmit={handleProfileNext} className="space-y-5">
              {/* Sex */}
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <select
                  id="sex"
                  value={sex}
                  onChange={e => setSex(e.target.value as 'male' | 'female')}
                  required
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="" disabled>Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Date of birth */}
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
                {dateOfBirth && (
                  <p className="text-xs text-muted-foreground">
                    Age:{' '}
                    {Math.floor(
                      (Date.now() - new Date(dateOfBirth).getTime()) /
                        (1000 * 60 * 60 * 24 * 365.25)
                    )}{' '}
                    years
                  </p>
                )}
              </div>

              {/* Height & Weight side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="175"
                    value={heightCm}
                    onChange={e => setHeightCm(e.target.value)}
                    min={100}
                    max={250}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="70"
                    value={weightKg}
                    onChange={e => setWeightKg(e.target.value)}
                    min={30}
                    max={300}
                    step="0.1"
                    required
                  />
                </div>
              </div>

              {/* Plan start date */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Plan start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={planStartDate}
                  onChange={e => setPlanStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to next Monday — change if you want to start on a different day
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={!profileComplete}>
                Continue
              </Button>
            </form>
          ) : (
            /* ── Step 2: Goal ── */
            <form onSubmit={handleGeneratePlan} className="space-y-6">
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setError(''); setCurrentStep(1) }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!goal.trim() || !fitnessLevel || !daysPerWeek}
                >
                  Generate my plan
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
