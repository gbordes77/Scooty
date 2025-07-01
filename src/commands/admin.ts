import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { DatabaseService } from '../services/database';
import { EmbedService } from '../services/embed';

export const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Commandes administrateur pour Scooty')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create-event')
      .setDescription('Créer un nouveau tournoi')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Nom du tournoi (ex: "GP Paris 2024")')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('start_date')
          .setDescription('Date de début (format: YYYY-MM-DD, défaut: aujourd\'hui)')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list-events')
      .setDescription('Afficher tous les tournois existants avec leurs statuts')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('update-event-status')
      .setDescription('Modifier le statut d\'un tournoi')
      .addStringOption(option =>
        option
          .setName('event_id')
          .setDescription('ID du tournoi à modifier')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('status')
          .setDescription('Nouveau statut du tournoi')
          .setRequired(true)
          .addChoices(
            { name: 'Actif', value: 'active' },
            { name: 'Terminé', value: 'completed' },
            { name: 'Annulé', value: 'cancelled' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete-scout')
      .setDescription('Supprimer un scout spécifique')
      .addStringOption(option =>
        option
          .setName('scout_id')
          .setDescription('ID du scout à supprimer')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('init-db')
      .setDescription('Initialiser la base de données et créer un tournoi par défaut')
  );

export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  // Vérifier les permissions admin
  if (!interaction.memberPermissions?.has('Administrator')) {
    const errorEmbed = embedService.createErrorEmbed('❌ Accès refusé. Commande réservée aux administrateurs.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'create-event':
        await handleCreateEventCommand(interaction, database, embedService);
        break;
      case 'list-events':
        await handleListEventsCommand(interaction, database, embedService);
        break;
      case 'update-event-status':
        await handleUpdateEventStatusCommand(interaction, database, embedService);
        break;
      case 'delete-scout':
        await handleDeleteScoutCommand(interaction, database, embedService);
        break;
      case 'init-db':
        await handleInitDbCommand(interaction, database, embedService);
        break;
      default:
        const errorEmbed = embedService.createErrorEmbed('❌ Sous-commande non reconnue');
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  } catch (error) {
    console.error('Error in admin command:', error);
    const errorEmbed = embedService.createErrorEmbed('❌ Une erreur inattendue s\'est produite');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleCreateEventCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  const name = interaction.options.getString('name', true);
  const startDateStr = interaction.options.getString('start_date');
  
  let startDate: Date;
  if (startDateStr) {
    startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      const errorEmbed = embedService.createErrorEmbed('❌ Format de date invalide. Utilisez YYYY-MM-DD');
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      return;
    }
  } else {
    startDate = new Date();
  }

  try {
    const event = await database.createTournamentEvent({
      name: name,
      start_date: startDate,
      status: 'active'
    });

    const successEmbed = embedService.createSuccessEmbed(
      '✅ Tournoi créé avec succès',
      `**${name}** a été créé avec l'ID: \`${event.id}\`\nDate de début: ${startDate.toLocaleDateString('fr-FR')}`
    );
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error: any) {
    const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de la création: ${error.message}`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleListEventsCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  try {
    const events = await database.getAllEvents();
    
    if (events.length === 0) {
      const embed = embedService.createInfoEmbed(
        '📋 Liste des Tournois',
        'Aucun tournoi trouvé. Utilisez `/admin create-event` pour en créer un.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const eventsList = events.map((event: any) => {
      const statusEmoji = event.status === 'active' ? '🟢' : event.status === 'completed' ? '✅' : '❌';
      const date = new Date(event.start_date).toLocaleDateString('fr-FR');
      return `${statusEmoji} **${event.name}**\n└ ID: \`${event.id}\`\n└ Statut: ${event.status}\n└ Date: ${date}`;
    }).join('\n\n');

    const embed = embedService.createInfoEmbed(
      '📋 Liste des Tournois',
      eventsList
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error: any) {
    const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de la récupération: ${error.message}`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleUpdateEventStatusCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  const eventId = interaction.options.getString('event_id', true);
  const status = interaction.options.getString('status', true);

  try {
    await database.updateEventStatus(eventId, status);
    
    const successEmbed = embedService.createSuccessEmbed(
      '✅ Statut mis à jour',
      `Le tournoi \`${eventId}\` a été marqué comme **${status}**`
    );
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error: any) {
    const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de la mise à jour: ${error.message}`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleDeleteScoutCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  const scoutId = interaction.options.getString('scout_id', true);

  try {
    await database.deleteScout(parseInt(scoutId));
    
    const successEmbed = embedService.createSuccessEmbed(
      '✅ Scout supprimé',
      `Le scout avec l'ID \`${scoutId}\` a été supprimé avec succès`
    );
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error: any) {
    const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de la suppression: ${error.message}`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleInitDbCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  try {
    await database.initializeDatabase();
    
    const successEmbed = embedService.createSuccessEmbed(
      '✅ Base de données initialisée',
      'La base de données a été initialisée avec succès et un tournoi par défaut a été créé.'
    );
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (error: any) {
    const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de l'initialisation: ${error.message}`);
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 