-- Running metrics
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS distance_km      float;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pace_min_per_km  float;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pace_km_per_h    float;

-- Lifting metrics
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS exercises_json   jsonb;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS total_volume_kg  float;

-- Index for weekly aggregate queries
CREATE INDEX IF NOT EXISTS workouts_user_logged_at
  ON workouts (user_id, logged_at DESC);
