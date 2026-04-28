-- Create timers table for real-time countdown timer sessions
CREATE TABLE IF NOT EXISTS timers (
  id TEXT PRIMARY KEY,
  total_seconds INTEGER NOT NULL DEFAULT 300,
  remaining_seconds INTEGER NOT NULL DEFAULT 300,
  is_running BOOLEAN NOT NULL DEFAULT false,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE timers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read timers (public access for sharing)
CREATE POLICY "Anyone can read timers" ON timers
  FOR SELECT USING (true);

-- Allow anyone to insert timers (no auth required for creating)
CREATE POLICY "Anyone can create timers" ON timers
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update timers (for real-time sync)
CREATE POLICY "Anyone can update timers" ON timers
  FOR UPDATE USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE timers;
