// ─── Shared types ──────────────────────────────────────────────────────────────

export interface ExerciseRecord {
  exerciseName: string
  muscleGroups: string[]
  sets: number | null
  reps: number | null
  weightKg: number | null
  volumeKg: number | null
}

export interface WorkoutRow {
  id: string
  logged_at: string
  raw_input?: string
  activity_type: string | null
  duration_minutes: number | null
  distance_km: number | null
  pace_min_per_km: number | null
  pace_km_per_h: number | null
  exercises_json: ExerciseRecord[] | null
  total_volume_kg: number | null
  parsed_json?: Record<string, unknown> | null
}

// ─── Running ───────────────────────────────────────────────────────────────────

export interface RunningWeekSummary {
  sessions: number
  totalDistanceKm: number
  totalDurationMinutes: number
  avgPaceMinPerKm: number | null
  avgPaceKmPerH: number | null
}

export function computeRunningWeek(workouts: WorkoutRow[]): RunningWeekSummary | null {
  const running = workouts.filter(
    w =>
      (w.activity_type === 'running' || w.activity_type === 'cycling') &&
      (w.distance_km != null || w.duration_minutes != null)
  )
  if (running.length === 0) return null

  const totalDistanceKm = running.reduce((s, w) => s + (w.distance_km ?? 0), 0)
  const totalDurationMinutes = running.reduce((s, w) => s + (w.duration_minutes ?? 0), 0)

  let avgPaceMinPerKm: number | null = null
  let avgPaceKmPerH: number | null = null
  if (totalDistanceKm > 0 && totalDurationMinutes > 0) {
    avgPaceMinPerKm = totalDurationMinutes / totalDistanceKm
    avgPaceKmPerH = Math.round((60 / avgPaceMinPerKm) * 10) / 10
  }

  return {
    sessions: running.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalDurationMinutes,
    avgPaceMinPerKm,
    avgPaceKmPerH,
  }
}

// ─── Lifting ───────────────────────────────────────────────────────────────────

export const MUSCLE_GROUPS = [
  // Upper push
  { key: 'chest',       label: 'Chest' },
  { key: 'shoulders',   label: 'Shoulders' },
  { key: 'triceps',     label: 'Triceps' },
  // Upper pull
  { key: 'back',        label: 'Back' },
  { key: 'biceps',      label: 'Biceps' },
  { key: 'forearms',    label: 'Forearms' },
  // Core
  { key: 'core',        label: 'Core' },
  // Lower
  { key: 'quads',       label: 'Quads' },
  { key: 'hamstrings',  label: 'Hams' },
  { key: 'glutes',      label: 'Glutes' },
  { key: 'calves',      label: 'Calves' },
] as const

export type MuscleKey = typeof MUSCLE_GROUPS[number]['key']

export type HeatLevel = 'none' | 'low' | 'medium' | 'high'

export interface MuscleGroupStat {
  key: MuscleKey
  label: string
  volumeKg: number
  frequency: number   // how many distinct sessions hit this group
  level: HeatLevel
}

export interface LiftingWeekSummary {
  sessions: number
  totalVolumeKg: number
  muscleGroups: MuscleGroupStat[]
}

export function computeLiftingWeek(workouts: WorkoutRow[]): LiftingWeekSummary | null {
  const lifting = workouts.filter(w => w.exercises_json && w.exercises_json.length > 0)
  if (lifting.length === 0) return null

  const muscleMap = new Map<string, { volumeKg: number; sessionIds: Set<string> }>()
  let totalVolumeKg = 0

  for (const workout of lifting) {
    for (const ex of workout.exercises_json!) {
      const vol = ex.volumeKg ?? 0
      totalVolumeKg += vol
      const groups = Array.isArray(ex.muscleGroups) ? ex.muscleGroups : []
      for (const g of groups) {
        const key = g.toLowerCase().trim()
        if (!muscleMap.has(key)) muscleMap.set(key, { volumeKg: 0, sessionIds: new Set() })
        const entry = muscleMap.get(key)!
        entry.volumeKg += vol
        entry.sessionIds.add(workout.id)
      }
    }
  }

  const maxVol = Math.max(...Array.from(muscleMap.values()).map(v => v.volumeKg), 1)

  const muscleGroups: MuscleGroupStat[] = MUSCLE_GROUPS.map(({ key, label }) => {
    const entry = muscleMap.get(key)
    const vol = entry?.volumeKg ?? 0
    const ratio = vol / maxVol
    const level: HeatLevel =
      vol === 0 ? 'none' : ratio < 0.2 ? 'low' : ratio < 0.55 ? 'medium' : 'high'
    return { key, label, volumeKg: Math.round(vol), frequency: entry?.sessionIds.size ?? 0, level }
  })

  return { sessions: lifting.length, totalVolumeKg: Math.round(totalVolumeKg), muscleGroups }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/** 7.0 → "7:00", 6.5 → "6:30" */
export function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** 90 → "1h 30min", 45 → "45 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

/** 4500 → "4,500" */
export function formatVolume(kg: number): string {
  return kg.toLocaleString('en-US')
}
