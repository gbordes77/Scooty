import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Scout, Archetype, ScoutStats, LiveEmbedData } from '../types';

export class EmbedService {
  private archetypeColors: Record<string, string> = {
    'jeskai_control': '#FFD700',
    'abzan_sorin': '#228B22',
    'jund_midrange': '#8B0000',
    'mono_green': '#00FF00',
    'azorius_tempo': '#1E90FF',
    'rakdos_sac': '#DC143C',
    'other': '#808080'
  };

  private archetypeEmojis: Record<string, string> = {
    'jeskai_control': '🔵🔴⚪',
    'abzan_sorin': '⚪⚫🟢',
    'jund_midrange': '⚫🔴🟢',
    'mono_green': '🟢',
    'azorius_tempo': '⚪🔵',
    'rakdos_sac': '⚫🔴',
    'other': '❓'
  };

  // Create scout confirmation embed
  createScoutEmbed(scout: Scout, isDuplicate: boolean = false): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(isDuplicate ? '⚠️ Scout Updated' : '✅ Scout Recorded')
      .setColor(isDuplicate ? '#FFA500' : '#00FF00')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot' });

    embed.addFields(
      { name: '👤 Opponent', value: scout.opponent, inline: true },
      { name: '🎴 Archetype', value: `${this.archetypeEmojis[scout.archetype] || '❓'} ${scout.archetype}`, inline: true },
      { name: '👁️ Scouted by', value: scout.scout_by, inline: true }
    );

    if (scout.comment) {
      embed.addFields({ name: '📝 Notes', value: scout.comment, inline: false });
    }

    if (isDuplicate) {
      embed.setDescription('This opponent was already scouted. Your report has been added as additional information.');
    }

    return embed;
  }

  // Create live feed embed
  createLiveEmbed(data: LiveEmbedData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎯 Live Scouting Feed - ${data.event_name}`)
      .setDescription(`**Round ${data.current_round}** • Last updated: ${data.last_updated}`)
      .setColor('#1E90FF')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Live Feed' });

    // Add recent scouts
    if (data.recent_scouts.length > 0) {
      const recentScoutsText = data.recent_scouts
        .slice(0, 10)
        .map(scout => {
          const emoji = this.archetypeEmojis[scout.archetype] || '❓';
          const time = new Date(scout.created_at).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          return `\`${time}\` ${emoji} **${scout.opponent}** - ${scout.archetype} (by ${scout.scout_by})`;
        })
        .join('\n');

      embed.addFields({
        name: '🕐 Recent Scouts',
        value: recentScoutsText || 'No scouts yet',
        inline: false
      });
    }

    // Add statistics
    if (data.stats) {
      const stats = data.stats;
      
      embed.addFields(
        { 
          name: '📊 Statistics', 
          value: `Total: **${stats.total_scouts}** scouts\nUnique opponents: **${stats.unique_opponents}**`, 
          inline: true 
        }
      );

      // Add top archetypes
      if (stats.archetype_breakdown.length > 0) {
        const topArchetypes = stats.archetype_breakdown
          .slice(0, 5)
          .map(arch => `${this.archetypeEmojis[arch.archetype] || '❓'} ${arch.archetype}: ${arch.count} (${arch.percentage}%)`)
          .join('\n');

        embed.addFields({
          name: '🏆 Top Archetypes',
          value: topArchetypes,
          inline: true
        });
      }

      // Add top contributors
      if (stats.top_contributors.length > 0) {
        const topContributors = stats.top_contributors
          .slice(0, 5)
          .map(contrib => `👤 **${contrib.username}**: ${contrib.count} scouts`)
          .join('\n');

        embed.addFields({
          name: '👑 Top Scouts',
          value: topContributors,
          inline: true
        });
      }
    }

    return embed;
  }

  // Create stats embed
  createStatsEmbed(stats: ScoutStats, eventName: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📊 Tournament Statistics - ${eventName}`)
      .setColor('#FFD700')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Statistics' });

    embed.addFields(
      { name: '📈 Total Scouts', value: stats.total_scouts.toString(), inline: true },
      { name: '👥 Unique Opponents', value: stats.unique_opponents.toString(), inline: true },
      { name: '📊 Average Scouts/Player', value: stats.total_scouts > 0 ? (stats.total_scouts / Math.max(stats.top_contributors.length, 1)).toFixed(1) : '0', inline: true }
    );

    // Archetype breakdown
    if (stats.archetype_breakdown.length > 0) {
      const archetypeText = stats.archetype_breakdown
        .map(arch => `${this.archetypeEmojis[arch.archetype] || '❓'} **${arch.archetype}**: ${arch.count} (${arch.percentage}%)`)
        .join('\n');

      embed.addFields({
        name: '🎴 Archetype Distribution',
        value: archetypeText,
        inline: false
      });
    }

    // Top contributors
    if (stats.top_contributors.length > 0) {
      const contributorsText = stats.top_contributors
        .map((contrib, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
          return `${medal} **${contrib.username}**: ${contrib.count} scouts`;
        })
        .join('\n');

      embed.addFields({
        name: '🏆 Top Contributors',
        value: contributorsText,
        inline: false
      });
    }

    return embed;
  }

  // Create opponent search embed
  createOpponentSearchEmbed(scouts: Scout[], opponent: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search Results for "${opponent}"`)
      .setColor('#1E90FF')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Search' });

    if (scouts.length === 0) {
      embed.setDescription('No scouts found for this opponent.');
      return embed;
    }

    const scoutText = scouts
      .map(scout => {
        const emoji = this.archetypeEmojis[scout.archetype] || '❓';
        const date = new Date(scout.created_at).toLocaleDateString('fr-FR');
        const time = new Date(scout.created_at).toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `${emoji} **${scout.archetype}** (${date} ${time})\n👤 by ${scout.scout_by}${scout.comment ? `\n📝 ${scout.comment}` : ''}`;
      })
      .join('\n\n');

    embed.addFields({
      name: `Found ${scouts.length} scout(s)`,
      value: scoutText,
      inline: false
    });

    return embed;
  }

  // Create error embed
  createErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(message)
      .setColor('#FF0000')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Error' });
  }

  // Create help embed
  createHelpEmbed(): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🎯 MTG Scout Bot - Help')
      .setDescription('Commands to help you scout opponents during tournaments')
      .setColor('#00FF00')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Help' });

    embed.addFields(
      {
        name: '🎯 /scout',
        value: 'Report opponent deck information\n`/scout opponent:Name archetype:Deck comment:Notes`',
        inline: false
      },
      {
        name: '🔍 /check',
        value: 'Search for existing scouts on an opponent\n`/check name:OpponentName`',
        inline: false
      },
      {
        name: '📊 /stats',
        value: 'View tournament statistics and meta breakdown',
        inline: false
      },
      {
        name: '❓ /help',
        value: 'Show this help message',
        inline: false
      }
    );

    embed.addFields({
      name: '💡 Tips',
      value: '• Use auto-completion for opponent names\n• Be specific in your comments\n• Scout even if opponent was already reported\n• Check the live feed for real-time updates',
      inline: false
    });

    return embed;
  }

  // Create admin embed
  createAdminEmbed(action: string, details: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`⚙️ Admin Action: ${action}`)
      .setDescription(details)
      .setColor('#FFA500')
      .setTimestamp()
      .setFooter({ text: 'MTG Scout Bot • Admin' });
  }

  // Create buttons for interactive embeds
  createActionButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_stats')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('export_data')
          .setLabel('📊 Export')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help')
          .setLabel('❓ Help')
          .setStyle(ButtonStyle.Secondary)
      );
  }
} 