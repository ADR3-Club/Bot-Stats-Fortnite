// src/commands/me.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayerStats, getAvailableModes, GAME_MODES } from '../services/epicStats.js';
import { getLinkedAccount, getCachedStats, cacheStats } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('me')
  .setDescription('Affiche tes stats Fortnite (compte lié)')
  .addStringOption(o => o
    .setName('mode')
    .setDescription('Mode de jeu spécifique')
    .setRequired(false)
    .addChoices(...getAvailableModes())
  );

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');

  // Vérifier si l'utilisateur a un compte lié
  const linked = getLinkedAccount(interaction.user.id);

  if (!linked) {
    return interaction.reply({
      content: '❌ Tu n\'as pas de compte Epic lié.\nUtilise `/link set <pseudo>` pour en lier un.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // Vérifier le cache
    let stats = getCachedStats(linked.epic_account_id);

    if (!stats) {
      // Récupérer les stats depuis l'API
      stats = await getPlayerStats(linked.epic_account_id);

      if (stats && !stats.private) {
        cacheStats(linked.epic_account_id, stats);
      }
    }

    if (!stats) {
      return interaction.editReply({
        content: `❌ Impossible de récupérer tes stats.`,
      });
    }

    if (stats.private) {
      return interaction.editReply({
        content: `🔒 Tes stats sont privées. Active-les dans les paramètres Fortnite.`,
      });
    }

    // Construire l'embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Tes stats - ${linked.epic_display_name}`)
      .setColor(0x9d5bd2)
      .setThumbnail(interaction.user.displayAvatarURL());

    if (mode && GAME_MODES[mode]) {
      // Stats d'un mode spécifique
      const modeStats = stats.modes[GAME_MODES[mode].name];

      if (!modeStats || modeStats.matches === 0) {
        return interaction.editReply({
          content: `❌ Tu n'as pas de stats en **${GAME_MODES[mode].name}**.`,
        });
      }

      embed.setDescription(`**Mode:** ${GAME_MODES[mode].name}`);
      embed.addFields(
        { name: '🏆 Victoires', value: `${modeStats.wins}`, inline: true },
        { name: '💀 Kills', value: `${modeStats.kills}`, inline: true },
        { name: '🎮 Parties', value: `${modeStats.matches}`, inline: true },
        { name: '📈 K/D', value: `${modeStats.kd}`, inline: true },
        { name: '🎯 Win Rate', value: `${modeStats.winRate}%`, inline: true },
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
        { name: '⏱️ Temps joué', value: formatPlaytime(stats.overall.minutesPlayed), inline: true },
      );

      // Modes favoris (top 3)
      const topModes = Object.entries(stats.modes)
        .filter(([, m]) => m.matches > 0)
        .sort((a, b) => b[1].matches - a[1].matches)
        .slice(0, 3);

      if (topModes.length > 0) {
        const modesText = topModes.map(([name, m]) =>
          `**${name}**: ${m.wins}W / ${m.kills}K (${m.winRate}%)`
        ).join('\n');
        embed.addFields({ name: '🎮 Tes modes favoris', value: modesText, inline: false });
      }
    }

    embed.setFooter({ text: 'Stats mises à jour toutes les 5 minutes' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (e) {
    console.error('Erreur me:', e);
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
