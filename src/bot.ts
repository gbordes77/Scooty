import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes,
  Events,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Message
} from 'discord.js';
import * as dotenv from 'dotenv';
import { DatabaseService } from './services/database';
import { CacheService } from './services/cache';
import { EmbedService } from './services/embed';
import { logger } from './utils/logger';

// Import commands
import { scoutCommand, handleScoutAutocomplete, handleScoutCommand } from './commands/scout';
import { checkCommand, handleCheckCommand } from './commands/check';
import { statsCommand, handleStatsCommand } from './commands/stats';
import { helpCommand, handleHelpCommand } from './commands/help';

// Load environment variables
dotenv.config();

// Initialize services
const database = new DatabaseService();
const cache = new CacheService();
const embedService = new EmbedService();

// Create Discord client
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Command collection
const commands = [
  scoutCommand,
  checkCommand,
  statsCommand,
  helpCommand
];

// Register slash commands
async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  
  try {
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID!,
        process.env.GUILD_ID!
      ),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error registering commands:', error);
  }
}

// Handle interactions
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'scout') {
        await handleScoutAutocomplete(interaction, database, cache);
      }
      return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'scout':
          await handleScoutCommand(interaction, database, cache, embedService);
          break;
        case 'check':
          await handleCheckCommand(interaction, database, embedService);
          break;
        case 'stats':
          await handleStatsCommand(interaction, database, embedService);
          break;
        case 'help':
          await handleHelpCommand(interaction, embedService);
          break;
        default:
          logger.warn(`Unknown command: ${interaction.commandName}`);
      }
    }
  } catch (error) {
    logger.error('Error handling interaction:', error);
    
    if (interaction.isRepliable()) {
      const errorEmbed = embedService.createErrorEmbed('An unexpected error occurred. Please try again.');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Live embed update system
let liveMessage: Message | null = null;
let updateInterval: NodeJS.Timeout | null = null;

async function updateLiveEmbed(): Promise<void> {
  try {
    const liveChannelId = process.env.LIVE_CHANNEL_ID;
    const liveMessageId = process.env.LIVE_MESSAGE_ID;
    
    if (!liveChannelId || !liveMessageId) {
      logger.warn('Live channel or message ID not configured');
      return;
    }

    // Get current event
    const currentEvent = await database.getCurrentEvent();
    if (!currentEvent) {
      logger.warn('No active event found for live embed');
      return;
    }

    // Check cache first
    let liveData = await cache.getLiveEmbedData(currentEvent.id);
    
    if (!liveData) {
      // Get fresh data
      const recentScouts = await database.getScoutsByEvent(currentEvent.id, 20);
      const stats = await database.getScoutStats(currentEvent.id);
      
      liveData = {
        event_name: currentEvent.name,
        current_round: currentEvent.current_round,
        recent_scouts: recentScouts,
        stats: stats,
        last_updated: new Date().toLocaleTimeString('fr-FR')
      };

      // Cache the data
      await cache.setLiveEmbedData(currentEvent.id, liveData);
    }

    // Get or create live message
    if (!liveMessage) {
      const channel = await client.channels.fetch(liveChannelId);
      if (channel && 'send' in channel && typeof channel.send === 'function') {
        try {
          liveMessage = await channel.messages.fetch(liveMessageId);
        } catch (error) {
          logger.warn('Could not fetch live message, creating new one');
          liveMessage = await channel.send({ content: 'Initializing live feed...' });
        }
      }
    }

    // Update the embed
    if (liveMessage) {
      const embed = embedService.createLiveEmbed(liveData);
      await liveMessage.edit({ embeds: [embed] });
    }

  } catch (error) {
    logger.error('Error updating live embed:', error);
  }
}

// Start live embed updates
function startLiveEmbedUpdates(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  updateInterval = setInterval(updateLiveEmbed, 30000); // Update every 30 seconds
  logger.info('Live embed updates started');
}

// Bot ready event
client.once(Events.ClientReady, async () => {
  logger.info(`✅ Bot ready as ${client.user?.tag}`);
  
  try {
    // Connect to cache
    await cache.connect();
    
    // Register commands
    await registerCommands();
    
    // Start live embed updates
    startLiveEmbedUpdates();
    
    // Initial live embed update
    await updateLiveEmbed();
    
    logger.info('Bot initialization complete');
  } catch (error) {
    logger.error('Error during bot initialization:', error);
  }
});

// Error handling
client.on(Events.Error, (error) => {
  logger.error('Discord client error:', error);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  await cache.disconnect();
  client.destroy();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down bot...');
  
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  await cache.disconnect();
  client.destroy();
  
  process.exit(0);
});

// Unhandled promise rejection
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login:', error);
  process.exit(1);
}); 