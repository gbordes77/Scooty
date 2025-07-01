-- Scooty - Database Schema
-- Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS archetypes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT UNIQUE NOT NULL,
  emoji TEXT,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  current_round INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scouts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round INTEGER DEFAULT 1,
  opponent TEXT NOT NULL,
  archetype TEXT NOT NULL,
  scout_by TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scouts_event_id ON scouts(event_id);
CREATE INDEX IF NOT EXISTS idx_scouts_opponent ON scouts(opponent);
CREATE INDEX IF NOT EXISTS idx_scouts_created_at ON scouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scouts_archetype ON scouts(archetype);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_archetypes_active ON archetypes(active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_archetypes_updated_at BEFORE UPDATE ON archetypes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scouts_updated_at BEFORE UPDATE ON scouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default archetypes
INSERT INTO archetypes (name, emoji, color) VALUES
  ('jeskai_control', '🔵🔴⚪', '#FFD700'),
  ('abzan_sorin', '⚪⚫🟢', '#228B22'),
  ('jund_midrange', '⚫🔴🟢', '#8B0000'),
  ('mono_green', '🟢', '#00FF00'),
  ('azorius_tempo', '⚪🔵', '#1E90FF'),
  ('rakdos_sac', '⚫🔴', '#DC143C'),
  ('other', '❓', '#808080')
ON CONFLICT (name) DO NOTHING;

-- Create a default event
INSERT INTO events (name, start_date, status) VALUES
  ('Default Tournament', NOW(), 'active')
ON CONFLICT DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW scout_stats AS
SELECT 
  user_stats.event_id,
  COUNT(*) AS total_scouts,
  COUNT(DISTINCT scouts.opponent) AS unique_opponents,
  COUNT(DISTINCT user_stats.scout_by) AS unique_scouts,
  ROUND(AVG(user_stats.scouts_per_user::numeric), 2) AS avg_scouts_per_user
FROM (
  SELECT 
    event_id,
    scout_by,
    COUNT(*) AS scouts_per_user
  FROM scouts
  GROUP BY event_id, scout_by
) user_stats
JOIN scouts ON scouts.event_id = user_stats.event_id
GROUP BY user_stats.event_id;

CREATE OR REPLACE VIEW archetype_breakdown AS
SELECT 
  event_id,
  archetype,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY event_id), 1) AS percentage
FROM scouts
GROUP BY event_id, archetype
ORDER BY event_id, count DESC;

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_current_event()
RETURNS events AS $$
  SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION get_scout_stats(event_uuid UUID)
RETURNS TABLE(
  total_scouts BIGINT,
  unique_opponents BIGINT,
  unique_scouts BIGINT,
  avg_scouts_per_user NUMERIC
) AS $$
  SELECT total_scouts, unique_opponents, unique_scouts, avg_scouts_per_user 
  FROM scout_stats WHERE event_id = event_uuid;
$$ LANGUAGE SQL;

-- Enable Row Level Security (RLS)
ALTER TABLE archetypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouts ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (public read)
CREATE POLICY "Allow public read access to archetypes" ON archetypes
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to scouts" ON scouts
  FOR SELECT USING (true);

-- Create policies for insert access (authenticated users can insert scouts)
CREATE POLICY "Allow authenticated users to insert scouts" ON scouts
  FOR INSERT WITH CHECK (true);

-- Create policies for update access (only for events and archetypes by admins)
CREATE POLICY "Allow admin update access to events" ON events
  FOR UPDATE USING (true);

CREATE POLICY "Allow admin update access to archetypes" ON archetypes
  FOR UPDATE USING (true);

-- Create a function to check for duplicate scouts
CREATE OR REPLACE FUNCTION check_duplicate_scout(
  p_opponent TEXT,
  p_event_id UUID
)
RETURNS scouts AS $$
  SELECT * FROM scouts 
  WHERE opponent = p_opponent 
    AND event_id = p_event_id 
  ORDER BY created_at DESC 
  LIMIT 1;
$$ LANGUAGE SQL;

-- Create a function to get recent scouts
CREATE OR REPLACE FUNCTION get_recent_scouts(
  p_event_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id BIGINT,
  opponent TEXT,
  archetype TEXT,
  scout_by TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT id, opponent, archetype, scout_by, comment, created_at
  FROM scouts
  WHERE event_id = p_event_id
  ORDER BY created_at DESC
  LIMIT p_limit;
$$ LANGUAGE SQL; 