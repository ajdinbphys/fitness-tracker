'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
type FitnessLevel = typeof FITNESS_LEVELS[number]

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

const STEPS = ['About you', 'Your goal'] as const

export default function OnboardingPage() {
  const router = useRouter()

  // Locked once set — never change after first save
  const [sex, setSex] = useState<'male' | 'female' | ''>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [profileLocked, setProfileLocked] = useState(false) // true if sex+dob already saved

  // Can change each time
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [planStartDate, setPlanStartDate] = useState(nextMonday())

  const [goal, setGoal] = useState('')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)

  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(({ profile }) => {
        if (profile) {
          if (profile.sex) setSex(profile.sex)
          if (profile.date_of_birth) setDateOfBirth(profile.date_of_birth)
          if (profile.sex && profile.date_of_birth) setProfileLocked(true)
          if (profile.height_cm) setHeightCm(String(profile.height_cm))
          if (profile.weight_kg) setWeightKg(String(profile.weight_kg))
        }
      })
      .finally(() => setProfileLoading(false))
  }, [])

  const age = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const profileComplete =
    sex !== '' && dateOfBirth !== '' && heightCm !== '' && weightKg !== '' && planStartDate !== ''

  function handleProfileNext(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!profileComplete) return
    setError('')
    setCurrentStep(2)
  }

  async function handleGeneratePlan(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!goal.trim() || !fitnessLevel || !daysPerWeek) return

    setError('')
    setGenerating(true)

    // Save profile (sex+dob only on first save; always update height+weight)
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sex: profileLocked ? undefined : sex,
        dateOfBirth: profileLocked ? undefined : dateOfBirth,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
      }),
    })

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

    const generateRes = await fetch('/api/plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        fitnessLevel,
        daysPerWeek,
        profile: { sex, dateOfBirth, heightCm: Number(heightCm), weightKg: Number(weightKg) },
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

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            {generating ? 'Building your plan…' : currentStep === 1 ? 'About you' : 'Your goal'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {generating
              ? 'Hang tight — Claude is personalising your training plan'
              : currentStep === 1
              ? 'We use this to personalise intensity and pacing'
              : 'Describe what you want to achieve'}
          </p>
        </div>

        {/* Step indicator */}
        {!generating && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {STEPS.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2
              const done = stepNum < currentStep
              const active = stepNum === currentStep
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                        done
                          ? 'bg-primary text-primary-foreground'
                          : active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {done ? '✓' : stepNum}
                    </div>
                    <span className={`text-xs ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-8 ${done ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Content */}
        {generating ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>

        ) : currentStep === 1 ? (
          /* ── Step 1: Profile ── */
          <form onSubmit={handleProfileNext} className="space-y-5">

            {profileLocked ? (
              /* Locked: sex + dob shown as read-only summary */
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Profile</p>
                  <p className="text-sm font-medium capitalize">
                    {sex}
                    {age !== null && <span className="text-muted-foreground font-normal">, {age} years old</span>}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground/60">Saved</span>
              </div>
            ) : (
              <>
                {/* Sex */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sex
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['male', 'female'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSex(s)}
                        className={`h-10 rounded-md border text-sm font-medium capitalize transition-all ${
                          sex === s
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date of birth */}
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date of birth{age !== null ? <span className="normal-case ml-2 text-muted-foreground/60">— {age} years old</span> : null}
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    className="h-10 bg-card border-border/60"
                  />
                </div>
              </>
            )}

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="height" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Height (cm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="175"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  min={100}
                  max={250}
                  required
                  className="h-10 bg-card border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Weight (kg)
                </Label>
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
                  className="h-10 bg-card border-border/60"
                />
              </div>
            </div>

            {/* Plan start date */}
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Plan start date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={planStartDate}
                onChange={e => setPlanStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="h-10 bg-card border-border/60"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to next Monday
              </p>
            </div>

            <Button type="submit" className="w-full h-10" disabled={!profileComplete}>
              Continue
            </Button>
          </form>

        ) : (
          /* ── Step 2: Goal ── */
          <form onSubmit={handleGeneratePlan} className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="goal" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Goal
              </Label>
              <Textarea
                id="goal"
                placeholder="e.g. I want to run a half marathon under 2 hours, the race is in 6 weeks"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                rows={3}
                required
                className="resize-none bg-card border-border/60 text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Include timeframes, distances, or targets for a more precise plan
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fitness level
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {FITNESS_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFitnessLevel(level)}
                    className={`h-10 rounded-md border text-sm font-medium capitalize transition-all ${
                      fitnessLevel === level
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Days per week
              </Label>
              <div className="flex gap-2">
                {DAYS_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysPerWeek(d)}
                    className={`h-10 w-10 rounded-md border text-sm font-medium transition-all ${
                      daysPerWeek === d
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'
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
                className="flex-1 h-10"
                onClick={() => { setError(''); setCurrentStep(1) }}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10"
                disabled={!goal.trim() || !fitnessLevel || !daysPerWeek || generating}
              >
                Generate plan
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
