import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { DatabaseService } from '../services/database';
import { EmbedService } from '../services/embed';

export const adminCommand = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Commandes administrateur pour Scooty')
  .addSubcommand(subcommand =>
    subcommand
      .setName('archetype')
      .setDescription('Gérer les archétypes')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Action à effectuer')
          .setRequired(true)
          .addChoices(
            { name: 'Ajouter', value: 'add' },
            { name: 'Supprimer', value: 'remove' },
            { name: 'Lister', value: 'list' }
          )
      )
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Nom de l\'archétype (ex: domain_ramp)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('emoji')
          .setDescription('Emojis de l\'archétype (ex: 🟢🔵)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('color')
          .setDescription('Couleur hexadécimale (ex: #4CAF50)')
          .setRequired(false)
      )
  );

export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  // Vérifier les permissions admin (à configurer selon vos besoins)
  const adminRoles = ['Admin', 'Moderator', 'TO']; // Roles autorisés
  const memberRoles = interaction.member?.roles;
  
  const hasAdminRole = Array.isArray(memberRoles) 
    ? memberRoles.some(role => adminRoles.includes(role))
    : false;

  if (!hasAdminRole) {
    const errorEmbed = embedService.createErrorEmbed('❌ Accès refusé. Commande réservée aux administrateurs.');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'archetype') {
    await handleArchetypeCommand(interaction, database, embedService);
  }
}

async function handleArchetypeCommand(
  interaction: ChatInputCommandInteraction,
  database: DatabaseService,
  embedService: EmbedService
): Promise<void> {
  const action = interaction.options.getString('action', true);
  const name = interaction.options.getString('name');
  const emoji = interaction.options.getString('emoji');
  const color = interaction.options.getString('color');

  try {
    switch (action) {
             case 'add':
         if (!name || !emoji || !color) {
           const errorEmbed = embedService.createErrorEmbed('❌ Pour ajouter un archétype, vous devez spécifier : name, emoji et color');
           await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
           return;
         }

         try {
           // Ajouter l'archétype en base
           await database.createArchetype({
             name: name,
             emoji: emoji,
             color: color,
             active: true
           });

           const successEmbed = embedService.createSuccessEmbed(
             '✅ Archétype ajouté',
             `**${name}** ${emoji} a été ajouté avec succès !`
           );
           await interaction.reply({ embeds: [successEmbed], ephemeral: true });
         } catch (error: any) {
           const errorEmbed = embedService.createErrorEmbed(`❌ Erreur lors de l'ajout: ${error.message}`);
           await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
         }
         break;

             case 'remove':
         if (!name) {
           const errorEmbed = embedService.createErrorEmbed('❌ Vous devez spécifier le nom de l\'archétype à supprimer');
           await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
           return;
         }

         // Pour l'instant, on affiche juste un message (fonctionnalité à implémenter)
         const removeSuccessEmbed = embedService.createSuccessEmbed(
           '⚠️ Fonctionnalité en développement',
           `La suppression d'archétypes sera bientôt disponible. Utilisez Supabase pour l'instant.`
         );
         await interaction.reply({ embeds: [removeSuccessEmbed], ephemeral: true });
         break;

       case 'list':
         // Lister tous les archétypes
         const archetypes = await database.getArchetypes();

         const embed = embedService.createInfoEmbed(
           '📋 Liste des Archétypes',
           archetypes.map((arch: any) => 
             `✅ **${arch.name}** ${arch.emoji} \`${arch.color}\``
           ).join('\n') || 'Aucun archétype trouvé'
         );

         await interaction.reply({ embeds: [embed], ephemeral: true });
         break;
    }
  } catch (error) {
    console.error('Error in admin archetype command:', error);
    const errorEmbed = embedService.createErrorEmbed('❌ Une erreur inattendue s\'est produite');
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
} 