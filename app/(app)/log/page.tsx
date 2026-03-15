'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

interface ParsedWorkout {
  activityType: string
  durationMinutes: number | null
  distance: string | null
  perceivedEffort: number | null
  date: string
  exercises: Array<{
    name: string
    sets: number | null
    reps: number | null
    weight: string | null
  }>
  notes: string | null
}

interface WorkoutEntry {
  id: string
  raw_input: string
  activity_type: string | null
  duration_minutes: number | null
  logged_at: string
  parsed_json: ParsedWorkout
}

interface LogResult {
  workout: WorkoutEntry
  parsed: ParsedWorkout
}

export default function LogPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<LogResult | null>(null)
  const [history, setHistory] = useState<WorkoutEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/log/history')
      const data = await res.json()
      if (res.ok) setHistory(data.workouts ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    setError('')
    setLastResult(null)

    const res = await fetch('/api/log/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: input }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    setLastResult(data)
    setInput('')
    setLoading(false)
    fetchHistory()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Log a Workout</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe your workout in plain text — Claude will extract the details
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder={`e.g. "did 5km this morning, felt tired" or "chest day, bench press 4×8 at 80kg, incline DB press 3×10, felt strong"`}
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={loading}
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading || !input.trim()} className="w-full">
              {loading ? 'Parsing...' : 'Log workout'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-800">Logged!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-green-700 italic">&ldquo;{lastResult.workout.raw_input}&rdquo;</p>
            <div className="flex flex-wrap gap-2">
              {lastResult.parsed.activityType && (
                <Badge className="capitalize bg-green-700">{lastResult.parsed.activityType}</Badge>
              )}
              {lastResult.parsed.durationMinutes && (
                <Badge variant="outline">{lastResult.parsed.durationMinutes} min</Badge>
              )}
              {lastResult.parsed.distance && (
                <Badge variant="outline">{lastResult.parsed.distance}</Badge>
              )}
              {lastResult.parsed.perceivedEffort && (
                <Badge variant="outline">RPE {lastResult.parsed.perceivedEffort}/10</Badge>
              )}
            </div>
            {lastResult.parsed.exercises.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-800 mb-1">Exercises</p>
                <ul className="space-y-1">
                  {lastResult.parsed.exercises.map((ex, i) => (
                    <li key={i} className="text-xs text-green-700">
                      {ex.name}
                      {ex.sets && ex.reps ? ` — ${ex.sets}×${ex.reps}` : ''}
                      {ex.weight ? ` @ ${ex.weight}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lastResult.parsed.notes && (
              <p className="text-xs text-green-600">{lastResult.parsed.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div>
        <h2 className="font-semibold mb-4">Workout History</h2>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workouts logged yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map((w) => (
              <Card key={w.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{w.raw_input}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {w.activity_type && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {w.activity_type}
                          </Badge>
                        )}
                        {w.duration_minutes && (
                          <Badge variant="outline" className="text-xs">
                            {w.duration_minutes} min
                          </Badge>
                        )}
                        {w.parsed_json?.distance && (
                          <Badge variant="outline" className="text-xs">
                            {w.parsed_json.distance}
                          </Badge>
                        )}
                        {w.parsed_json?.perceivedEffort && (
                          <Badge variant="outline" className="text-xs">
                            RPE {w.parsed_json.perceivedEffort}/10
                          </Badge>
                        )}
                      </div>
                      {w.parsed_json?.exercises?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {w.parsed_json.exercises.map(ex => ex.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(w.logged_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
