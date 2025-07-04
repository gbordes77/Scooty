import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Scout, Archetype, Event, ScoutStats } from '../types';
import { logger } from '../utils/logger';

export class DatabaseService {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // Scout Operations
  async createScout(scout: Omit<Scout, 'id' | 'created_at'>): Promise<Scout> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .insert(scout)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Scout created: ${scout.opponent} - ${scout.archetype}`);
      return data;
    } catch (error) {
      logger.error('Error creating scout:', error);
      throw error;
    }
  }

  async updateScout(scoutId: number, updates: { archetype: string; scout_by: string; comment: string }): Promise<Scout> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .update({
          archetype: updates.archetype,
          scout_by: updates.scout_by,
          comment: updates.comment,
          updated_at: new Date().toISOString()
        })
        .eq('id', scoutId)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Scout updated: ID ${scoutId} - ${updates.archetype}`);
      return data;
    } catch (error) {
      logger.error('Error updating scout:', error);
      throw error;
    }
  }

  async getScoutsByEvent(eventId: string, limit = 50): Promise<Scout[]> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching scouts:', error);
      return [];
    }
  }

  async getScoutsByOpponent(opponent: string): Promise<Scout[]> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .select('*')
        .ilike('opponent', `%${opponent}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching opponent scouts:', error);
      return [];
    }
  }

  async checkDuplicateScout(opponent: string, eventId: string): Promise<Scout | null> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .select('*')
        .eq('opponent', opponent)
        .eq('event_id', eventId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      logger.error('Error checking duplicate scout:', error);
      return null;
    }
  }

  // Archetype Operations
  async getArchetypes(): Promise<Archetype[]> {
    try {
      const { data, error } = await this.client
        .from('archetypes')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching archetypes:', error);
      return [];
    }
  }

  async createArchetype(archetype: Omit<Archetype, 'id'>): Promise<Archetype> {
    try {
      const { data, error } = await this.client
        .from('archetypes')
        .insert(archetype)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Archetype created: ${archetype.name}`);
      return data;
    } catch (error) {
      logger.error('Error creating archetype:', error);
      throw error;
    }
  }

  // Event Operations
  async getCurrentEvent(): Promise<Event | null> {
    try {
      const { data, error } = await this.client
        .from('events')
        .select('*')
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      logger.error('Error fetching current event:', error);
      return null;
    }
  }

  async createEvent(event: Omit<Event, 'id'>): Promise<Event> {
    try {
      const { data, error } = await this.client
        .from('events')
        .insert(event)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Event created: ${event.name}`);
      return data;
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  // Statistics
  async getScoutStats(eventId: string): Promise<ScoutStats> {
    try {
      // Get total scouts
      const { count: totalScouts } = await this.client
        .from('scouts')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

      // Get unique opponents
      const { count: uniqueOpponents } = await this.client
        .from('scouts')
        .select('opponent', { count: 'exact', head: true })
        .eq('event_id', eventId);

      // Get top contributors
      const { data: contributors } = await this.client
        .from('scouts')
        .select('scout_by')
        .eq('event_id', eventId);

      const contributorCounts = contributors?.reduce((acc: Record<string, number>, scout) => {
        acc[scout.scout_by] = (acc[scout.scout_by] || 0) + 1;
        return acc;
      }, {});

      const topContributors = Object.entries(contributorCounts || {})
        .map(([username, count]) => ({ username, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get archetype breakdown
      const { data: archetypeData } = await this.client
        .from('scouts')
        .select('archetype')
        .eq('event_id', eventId);

      const archetypeCounts = archetypeData?.reduce((acc: Record<string, number>, scout) => {
        acc[scout.archetype] = (acc[scout.archetype] || 0) + 1;
        return acc;
      }, {});

      const archetypeBreakdown = Object.entries(archetypeCounts || {})
        .map(([archetype, count]) => ({
          archetype,
          count,
          percentage: Math.round((count / (totalScouts || 1)) * 100)
        }))
        .sort((a, b) => b.count - a.count);

      return {
        total_scouts: totalScouts || 0,
        unique_opponents: uniqueOpponents || 0,
        top_contributors: topContributors,
        archetype_breakdown: archetypeBreakdown
      };
    } catch (error) {
      logger.error('Error fetching scout stats:', error);
      return {
        total_scouts: 0,
        unique_opponents: 0,
        top_contributors: [],
        archetype_breakdown: []
      };
    }
  }

  // Search opponents for autocomplete
  async searchOpponents(query: string, eventId: string): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('scouts')
        .select('opponent')
        .eq('event_id', eventId)
        .ilike('opponent', `%${query}%`)
        .limit(10);

      if (error) throw error;
      
      const uniqueOpponents = [...new Set(data?.map(s => s.opponent) || [])];
      return uniqueOpponents;
    } catch (error) {
      logger.error('Error searching opponents:', error);
      return [];
    }
  }

  // Tournament Event Operations
  async createTournamentEvent(params: { name: string; start_date: Date; status: string }): Promise<Event> {
    try {
      // Si on crée un nouveau tournoi actif, désactiver les autres
      if (params.status === 'active') {
        await this.client
          .from('events')
          .update({ status: 'completed' })
          .eq('status', 'active');
      }

      const event = {
        name: params.name,
        start_date: params.start_date.toISOString(),
        status: params.status
      };

      const { data, error } = await this.client
        .from('events')
        .insert(event)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Tournament event created: ${params.name}`);
      return data;
    } catch (error) {
      logger.error('Error creating tournament event:', error);
      throw error;
    }
  }

  // Get all events
  async getAllEvents(): Promise<Event[]> {
    try {
      const { data, error } = await this.client
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching all events:', error);
      return [];
    }
  }

  // Update event status
  async updateEventStatus(eventId: string, status: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('events')
        .update({ status })
        .eq('id', eventId);

      if (error) throw error;
      
      logger.info(`Event ${eventId} status updated to: ${status}`);
    } catch (error) {
      logger.error('Error updating event status:', error);
      throw error;
    }
  }

  // Delete scout
  async deleteScout(scoutId: number): Promise<void> {
    try {
      const { error } = await this.client
        .from('scouts')
        .delete()
        .eq('id', scoutId);

      if (error) throw error;
      
      logger.info(`Scout ${scoutId} deleted`);
    } catch (error) {
      logger.error('Error deleting scout:', error);
      throw error;
    }
  }

  // Initialize database with default event if none exists
  async initializeDatabase(): Promise<void> {
    try {
      const currentEvent = await this.getCurrentEvent();
      
      if (!currentEvent) {
        logger.info('No active event found, creating default tournament...');
        await this.createTournamentEvent({
          name: 'Default Tournament',
          start_date: new Date(),
          status: 'active'
        });
        logger.info('✅ Default tournament created successfully');
      } else {
        logger.info(`✅ Active tournament found: ${currentEvent.name}`);
      }
    } catch (error) {
      logger.error('Error initializing database:', error);
      throw error;
    }
  }
} 