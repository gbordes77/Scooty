import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction
} from 'discord.js';
import { EmbedService } from '../services/embed';
import { logger } from '../utils/logger';

export const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show help and usage information');

export async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
  embedService: EmbedService
): Promise<void> {
  try {
    const username = interaction.user.username;

    // Create help embed
    const embed = embedService.createHelpEmbed();

    // Send response
    await interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });

    // Log the help request
    logger.info(`Help requested by ${username}`);

  } catch (error) {
    logger.error('Error in help command:', error);
    const errorEmbed = embedService.createErrorEmbed('Failed to load help. Please try again.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 