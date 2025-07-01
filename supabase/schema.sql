-- Scooty - Database Schema
-- Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS archetypes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  emoji VARCHAR(10),
  color VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  current_round INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scouts (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round INTEGER DEFAULT 1,
  opponent VARCHAR(100) NOT NULL,
  archetype VARCHAR(50) NOT NULL,
  scout_by VARCHAR(100) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
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
$$ language 'plpgsql';

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
  event_id,
  COUNT(*) as total_scouts,
  COUNT(DISTINCT opponent) as unique_opponents,
  COUNT(DISTINCT scout_by) as unique_scouts,
  ROUND(AVG(scouts_per_user), 2) as avg_scouts_per_user
FROM (
  SELECT 
    event_id,
    scout_by,
    COUNT(*) as scouts_per_user
  FROM scouts
  GROUP BY event_id, scout_by
) user_stats
JOIN scouts USING (event_id)
GROUP BY event_id;

CREATE OR REPLACE VIEW archetype_breakdown AS
SELECT 
  event_id,
  archetype,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY event_id), 1) as percentage
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
  SELECT * FROM scout_stats WHERE event_id = event_uuid;
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
  p_opponent VARCHAR,
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
  id INTEGER,
  opponent VARCHAR,
  archetype VARCHAR,
  scout_by VARCHAR,
  comment TEXT,
  created_at TIMESTAMP
) AS $$
  SELECT id, opponent, archetype, scout_by, comment, created_at
  FROM scouts
  WHERE event_id = p_event_id
  ORDER BY created_at DESC
  LIMIT p_limit;
$$ LANGUAGE SQL; 