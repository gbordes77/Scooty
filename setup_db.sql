-- Simple database setup for Scooty bot
-- Run this in Supabase SQL Editor

-- Supprimer les tables existantes si elles existent
DROP TABLE IF EXISTS scouts CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS archetypes CASCADE;

-- Créer la table events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer la table scouts
CREATE TABLE scouts (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  archetype TEXT NOT NULL,
  scout_by TEXT NOT NULL,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Créer la table archetypes
CREATE TABLE archetypes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  emoji TEXT,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer des archétypes par défaut
INSERT INTO archetypes (name, emoji, color) VALUES
  ('jeskai_control', '🔵🔴⚪', '#FFD700'),
  ('abzan_sorin', '⚪⚫🟢', '#228B22'),
  ('jund_midrange', '⚫🔴🟢', '#8B0000'),
  ('mono_green', '🟢', '#00FF00'),
  ('azorius_tempo', '⚪🔵', '#1E90FF'),
  ('rakdos_sac', '⚫🔴', '#DC143C'),
  ('other', '❓', '#808080'); 