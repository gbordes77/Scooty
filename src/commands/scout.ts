import { 
  SlashCommandBuilder, 
  AutocompleteInteraction, 
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { DatabaseService } from '../services/database';
import { CacheService } from '../services/cache';
import { EmbedService } from '../services/embed';
import { logger } from '../utils/logger';

export const scoutCommand = new SlashCommandBuilder()
  .setName('scout')
  .setDescription('Report opponent deck information')
  .addStringOption(option =>
    option.setName('opponent')
      .setDescription('Opponent name (use auto-completion)')
      .setRequired(true)
      .setAutocomplete(true))
  .addStringOption(option =>
    option.setName('archetype')
      .setDescription('Deck archetype')
      .setRequired(true)
      .addChoices(
        { name: '🔵🔴⚪ Jeskai Control', value: 'jeskai_control' },
        { name: '⚪⚫🟢 Abzan Sorin', value: 'abzan_sorin' },
        { name: '⚫🔴🟢 Jund Midrange', value: 'jund_midrange' },
        { name: '🟢 Mono Green Stompy', value: 'mono_green' },
        { name: '⚪🔵 Azorius Tempo', value: 'azorius_tempo' },
        { name: '⚫🔴 Rakdos Sacrifice', value: 'rakdos_sac' },
        { name: '❓ Other/Unknown', value: 'other' }
      ))
  .addStringOption(option =>
    option.setName('comment')
      .setDescription('Important notes (ex: 4 Sorin, no Sheoldred...)')
      .setRequired(false)
      .setMaxLength(500));

export async function handleScoutAutocomplete(
  interaction: AutocompleteInteraction,
  database: DatabaseService,
  cache: CacheService
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused();
    const currentEvent = await database.getCurrentEvent();
    
    if (!currentEvent) {
      await interaction.respond([
        { name: '❌ No active event', value: 'no_event' }
      ]);
      return;
    }

    // Check cache first
    let opponents = await cache.getOpponentSuggestions(focusedValue, currentEvent.id);
    
    if (opponents.length === 0) {
      // Search database
      opponents = await database.searchOpponents(focusedValue, currentEvent.id);
      // Cache results
      await cache.setOpponentSuggestions(focusedValue, currentEvent.id, opponents);
    }

    const choices = [];

    // Add existing opponents with warning
    for (const opponent of opponents.slice(0, 8)) {
      const existingScout = await database.checkDuplicateScout(opponent, currentEvent.id);
      if (existingScout) {
        choices.push({
          name: `⚠️ ${opponent} - ALREADY SEEN: ${existingScout.archetype} (by ${existingScout.scout_by})`,
          value: opponent
        });
      } else {
        choices.push({
          name: `➕ New opponent: ${opponent}`,
          value: opponent
        });
      }
    }

    // Add new option if not found
    if (focusedValue && !opponents.find(o => o.toLowerCase() === focusedValue.toLowerCase())) {
      choices.push({
        name: `➕ New opponent: ${focusedValue}`,
        value: focusedValue
      });
    }

    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    logger.error('Error in scout autocomplete:', error);
    await interaction.respond([
      { name: '❌ Error loading suggestions', value: 'error' }
    ]);
  }
}

export async function handleScoutCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  cache: CacheService,
  embedService: EmbedService
): Promise<void> {
  try {
    const opponent = interaction.options.getString('opponent', true);
    const archetype = interaction.options.getString('archetype', true);
    const comment = interaction.options.getString('comment');
    const username = interaction.user.username;

    // Get current event
    const currentEvent = await database.getCurrentEvent();
    if (!currentEvent) {
      const errorEmbed = embedService.createErrorEmbed('No active tournament found. Please contact an administrator.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Check for existing scout
    const existingScout = await database.checkDuplicateScout(opponent, currentEvent.id);
    const isDuplicate = !!existingScout;

    // Create scout record
    const scout = await database.createScout({
      event_id: currentEvent.id,
      round: currentEvent.current_round,
      opponent,
      archetype,
      scout_by: username,
      comment: comment ?? ''
    });

    // Invalidate cache
    await cache.invalidateScoutCache(currentEvent.id);

    // Create response embed
    const embed = embedService.createScoutEmbed(scout, isDuplicate);

    // Send response
    await interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });

    // Log the scout
    logger.info(`Scout recorded by ${username}: ${opponent} - ${archetype}`, {
      event: currentEvent.name,
      round: currentEvent.current_round,
      duplicate: isDuplicate
    });

    // Send to admin channel if duplicate
    if (isDuplicate && existingScout) {
      const adminChannelId = process.env.ADMIN_CHANNEL_ID;
      if (adminChannelId) {
        const adminChannel = await interaction.client.channels.fetch(adminChannelId);
        if (adminChannel && 'send' in adminChannel && typeof adminChannel.send === 'function') {
          const conflictEmbed = new EmbedBuilder()
            .setTitle('⚠️ Scout Conflict Detected')
            .setDescription(`**${opponent}** was reported with different archetypes:`)
            .addFields(
              { name: 'Previous Report', value: `${existingScout.archetype} (by ${existingScout.scout_by})`, inline: true },
              { name: 'New Report', value: `${archetype} (by ${username})`, inline: true }
            )
            .setColor('#FFA500')
            .setTimestamp();

          await adminChannel.send({ embeds: [conflictEmbed] });
        }
      }
    }

  } catch (error) {
    logger.error('Error in scout command:', error);
    const errorEmbed = embedService.createErrorEmbed('Failed to record scout. Please try again or contact an administrator.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 