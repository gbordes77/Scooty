import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction
} from 'discord.js';
import { DatabaseService } from '../services/database';
import { EmbedService } from '../services/embed';
import { logger } from '../utils/logger';

export const statsCommand = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View tournament statistics and meta breakdown');

export async function handleStatsCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  try {
    const username = interaction.user.username;

    // Get current event
    const currentEvent = await database.getCurrentEvent();
    if (!currentEvent) {
      const errorEmbed = embedService.createErrorEmbed('No active tournament found. Please contact an administrator.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Get statistics
    const stats = await database.getScoutStats(currentEvent.id);

    // Create embed
    const embed = embedService.createStatsEmbed(stats, currentEvent.name);

    // Send response
    await interaction.reply({ 
      embeds: [embed], 
      ephemeral: true // Message privé
    });

    // Log the stats request
    logger.info(`Stats requested by ${username} for event: ${currentEvent.name}`, {
      total_scouts: stats.total_scouts,
      unique_opponents: stats.unique_opponents
    });

  } catch (error) {
    logger.error('Error in stats command:', error);
    const errorEmbed = embedService.createErrorEmbed('Failed to load statistics. Please try again.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 