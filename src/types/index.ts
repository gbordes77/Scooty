export interface Scout {
  id: number;
  event_id: string;
  round: number;
  opponent: string;
  archetype: string;
  scout_by: string;
  comment?: string;
  created_at: string;
}

export interface Archetype {
  id: number;
  name: string;
  emoji: string;
  color: string;
  active: boolean;
}

export interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'cancelled';
  current_round: number;
}

export interface ScoutStats {
  total_scouts: number;
  unique_opponents: number;
  top_contributors: Array<{
    username: string;
    count: number;
  }>;
  archetype_breakdown: Array<{
    archetype: string;
    count: number;
    percentage: number;
  }>;
}

export interface DiscordInteraction {
  id: string;
  type: number;
  data?: {
    name: string;
    options?: Array<{
      name: string;
      value: string;
    }>;
  };
  user: {
    id: string;
    username: string;
  };
  guild_id: string;
  channel_id: string;
}

export interface LiveEmbedData {
  event_name: string;
  current_round: number;
  recent_scouts: Scout[];
  stats: ScoutStats;
  last_updated: string;
}

export interface CacheData {
  opponents: string[];
  archetypes: Archetype[];
  live_embed: LiveEmbedData;
} 