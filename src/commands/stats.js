// src/commands/stats.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { findPlayer, findPlayerById, getPlayerStats, getAvailableModes, GAME_MODES } from '../services/epicStats.js';
import { getCachedStats, cacheStats, getLinkedAccount } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Affiche les stats Fortnite d\'un joueur')
  .addStringOption(o => o
    .setName('mode')
    .setDescription('Mode de jeu spécifique')
    .setRequired(false)
    .addChoices(...getAvailableModes())
  )
  .addStringOption(o => o
    .setName('pseudo')
    .setDescription('Pseudo Epic Games (optionnel si compte lié)')
    .setRequired(false)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo');
  const mode = interaction.options.getString('mode');

  await interaction.deferReply();

  try {
    let player;

    if (pseudo) {
      // Rechercher le joueur par pseudo
      player = await findPlayer(pseudo);

      if (!player) {
        return interaction.editReply({
          content: `❌ Joueur **${pseudo}** non trouvé.`,
        });
      }
    } else {
      // Utiliser le compte lié
      const linked = getLinkedAccount(interaction.user.id);

      if (!linked) {
        return interaction.editReply({
          content: '❌ Pseudo non spécifié et aucun compte lié.\nUtilise `/link set <pseudo>` ou `/stats pseudo:<pseudo>`.',
        });
      }

      player = {
        id: linked.epic_account_id,
        displayName: linked.epic_display_name,
      };
    }

    // Vérifier le cache
    let stats = getCachedStats(player.id);

    if (!stats) {
      // Récupérer les stats depuis l'API
      stats = await getPlayerStats(player.id);

      if (stats && !stats.private) {
        cacheStats(player.id, stats);
      }
    }

    if (!stats) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer les stats de **${player.displayName}**.`,
      });
    }

    if (stats.private) {
      return interaction.editReply({
        content: `🔒 Les stats de **${player.displayName}** sont privées.`,
      });
    }

    // Construire l'embed
    const platformEmojis = { psn: '🎮', xbl: '🎮', nintendo: '🕹️' };
    const platformNames = { psn: 'PlayStation', xbl: 'Xbox', nintendo: 'Nintendo' };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats de ${player.displayName}`)
      .setColor(0x9d5bd2)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }));

    // Afficher la plateforme si trouvé via console
    if (player.platform) {
      embed.setAuthor({
        name: `${platformEmojis[player.platform]} ${platformNames[player.platform]} • ${player.externalDisplayName}`
      });
    }

    if (mode && GAME_MODES[mode]) {
      // Stats d'un mode spécifique
      const modeStats = stats.modes[GAME_MODES[mode].name];

      if (!modeStats || modeStats.matches === 0) {
        return interaction.editReply({
          content: `❌ **${player.displayName}** n'a pas de stats en **${GAME_MODES[mode].name}**.`,
        });
      }

      embed.setDescription(`**Mode:** ${GAME_MODES[mode].name}`);
      embed.addFields(
        { name: '🏆 Victoires', value: `${modeStats.wins}`, inline: true },
        { name: '💀 Kills', value: `${modeStats.kills}`, inline: true },
        { name: '🎮 Parties', value: `${modeStats.matches}`, inline: true },
        { name: '📈 K/D', value: `${modeStats.kd}`, inline: true },
        { name: '🎯 Win Rate', value: `${modeStats.winRate}%`, inline: true },
        { name: '👥 Outlived', value: `${modeStats.playersOutlived || 0}`, inline: true },
        { name: '⭐ Score', value: `${(modeStats.score || 0).toLocaleString()}`, inline: true },
        { name: '⏱️ Temps', value: formatPlaytime(modeStats.minutesPlayed || 0), inline: true },
      );
    } else {
      // Stats globales
      embed.setDescription('**Stats globales (tous modes)**');
      embed.addFields(
        { name: '🏆 Victoires', value: `${stats.overall.wins}`, inline: true },
        { name: '💀 Kills', value: `${stats.overall.kills}`, inline: true },
        { name: '🎮 Parties', value: `${stats.overall.matches}`, inline: true },
        { name: '📈 K/D', value: `${stats.overall.kd}`, inline: true },
        { name: '🎯 Win Rate', value: `${stats.overall.winRate}%`, inline: true },
        { name: '👥 Outlived', value: `${(stats.overall.playersOutlived || 0).toLocaleString()}`, inline: true },
        { name: '⭐ Score', value: `${(stats.overall.score || 0).toLocaleString()}`, inline: true },
        { name: '⏱️ Temps joué', value: formatPlaytime(stats.overall.minutesPlayed), inline: true },
      );

      // Top 3 modes avec le plus de parties
      const topModes = Object.entries(stats.modes)
        .filter(([, m]) => m.matches > 0)
        .sort((a, b) => b[1].matches - a[1].matches)
        .slice(0, 3);

      if (topModes.length > 0) {
        const modesText = topModes.map(([name, m]) =>
          `**${name}**: ${m.wins}W / ${m.kills}K / ${m.matches} parties`
        ).join('\n');
        embed.addFields({ name: '📋 Top Modes', value: modesText, inline: false });
      }
    }

    embed.setFooter({ text: 'Stats via Epic Games API' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (e) {
    console.error('Erreur stats:', e);
    await interaction.editReply({
      content: `❌ Erreur: ${e.message}`,
    });
  }
}

function formatPlaytime(minutes) {
  if (!minutes) return '0h';
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}j ${remainingHours}h`;
  }
  return `${hours}h ${minutes % 60}m`;
}
