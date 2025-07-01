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
import * as http from 'http';
import { DatabaseService } from './services/database';
import { CacheService } from './services/cache';
import { EmbedService } from './services/embed';
import { logger } from './utils/logger';

// Import commands
import { scoutCommand, handleScoutAutocomplete, handleScoutCommand } from './commands/scout';
import { checkCommand, handleCheckCommand } from './commands/check';
import { statsCommand, handleStatsCommand } from './commands/stats';
import { helpCommand, handleHelpCommand } from './commands/help';
import { adminCommand, handleAdminCommand } from './commands/admin';

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
    GatewayIntentBits.GuildMessages
  ] 
});

// Command collection
const commands = [
  scoutCommand,
  checkCommand,
  statsCommand,
  helpCommand,
  adminCommand
];

// Register slash commands
async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
  
  try {
    logger.info('Started refreshing application (/) commands.');

    // Register globally instead of guild-specific for simplicity
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
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
        case 'admin':
          await handleAdminCommand(interaction, database, embedService);
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
    // Skip live embed updates if not configured
    const liveChannelId = process.env.LIVE_CHANNEL_ID;
    const liveMessageId = process.env.LIVE_MESSAGE_ID;
    
    if (!liveChannelId || !liveMessageId || 
        liveChannelId === 'channel_id_for_live_feed' || 
        liveMessageId === 'message_id_to_edit') {
      return; // Skip silently if not configured
    }

    // Get current event (handle if doesn't exist)
    let currentEvent;
    try {
      currentEvent = await database.getCurrentEvent();
    } catch (error) {
      return; // Skip if database not ready
    }
    
    if (!currentEvent) {
      return; // Skip if no event
    }

    // Get fresh data (without cache for simplicity)
    const recentScouts = await database.getScoutsByEvent(currentEvent.id, 20);
    const stats = await database.getScoutStats(currentEvent.id);
    
    const liveData = {
      event_name: currentEvent.name,
      current_round: currentEvent.current_round,
      recent_scouts: recentScouts,
      stats: stats,
      last_updated: new Date().toLocaleTimeString('fr-FR')
    };

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
    // Silently skip errors for live embed
    return;
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
    // Try to connect to cache (optional)
    try {
      await cache.connect();
      logger.info('Cache connected successfully');
    } catch (error) {
      logger.warn('Cache connection failed, continuing without cache');
    }
    
    // Register commands
    await registerCommands();
    
    // Start live embed updates (optional)
    startLiveEmbedUpdates();
    
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

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      bot: client.isReady() ? 'ready' : 'not ready',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info(`Health server listening on port ${port}`);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error('Failed to login:', error);
  process.exit(1);
}); 