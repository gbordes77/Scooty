import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction
} from 'discord.js';
import { DatabaseService } from '../services/database';
import { EmbedService } from '../services/embed';
import { logger } from '../utils/logger';

export const checkCommand = new SlashCommandBuilder()
  .setName('check')
  .setDescription('Search for existing scouts on an opponent')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('Opponent name to search for')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(100));

export async function handleCheckCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  try {
    const opponentName = interaction.options.getString('name', true);
    const username = interaction.user.username;

    // Get current event
    const currentEvent = await database.getCurrentEvent();
    if (!currentEvent) {
      const errorEmbed = embedService.createErrorEmbed('No active tournament found. Please contact an administrator.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }

    // Search for scouts
    const scouts = await database.getScoutsByOpponent(opponentName);

    // Filter to current event
    const eventScouts = scouts.filter(scout => scout.event_id === currentEvent.id);

    // Create embed
    const embed = embedService.createOpponentSearchEmbed(eventScouts, opponentName);

    // Send response
    await interaction.reply({ 
      embeds: [embed], 
      ephemeral: false // Visible to all
    });

    // Log the search
    logger.info(`Opponent search by ${username}: "${opponentName}" - Found ${eventScouts.length} scouts`);

  } catch (error) {
    logger.error('Error in check command:', error);
    const errorEmbed = embedService.createErrorEmbed('Failed to search for opponent. Please try again.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 