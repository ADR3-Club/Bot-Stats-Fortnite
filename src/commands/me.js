// src/commands/me.js
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getPlayerStats, getAvailableModes, GAME_MODES, SEASONS, formatPlaytime } from '../services/epicStats.js';
import { getLinkedAccount, getCachedStats, cacheStats } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('me')
  .setDescription('Affiche tes stats Fortnite (compte lié)')
  .addStringOption(o => o
    .setName('mode')
    .setDescription('Mode de jeu spécifique')
    .setRequired(false)
    .addChoices(...getAvailableModes())
  )
  .addBooleanOption(o => o
    .setName('saison')
    .setDescription('Stats de la saison actuelle uniquement')
    .setRequired(false)
  );

export async function execute(interaction) {
  const mode = interaction.options.getString('mode');
  const seasonOnly = interaction.options.getBoolean('saison') || false;

  // Vérifier si l'utilisateur a un compte lié
  const linked = getLinkedAccount(interaction.user.id);

  if (!linked) {
    return interaction.reply({
      content: '❌ Tu n\'as pas de compte Epic lié.\nUtilise `/link set <pseudo>` pour en lier un.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();

  try {
    // Options pour le filtrage par saison
    const statsOptions = seasonOnly ? { startTime: SEASONS.current.startTime } : {};

    // Vérifier le cache (seulement pour stats lifetime)
    let stats = seasonOnly ? null : getCachedStats(linked.epic_account_id);

    if (!stats) {
      // Récupérer les stats depuis l'API
      stats = await getPlayerStats(linked.epic_account_id, statsOptions);

      if (stats && !stats.private && !seasonOnly) {
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
    const platformIcons = {
      psn: 'https://cdn.discordapp.com/emojis/1448005088168771656.png',
      xbl: 'https://cdn.discordapp.com/emojis/1448004371714408579.png',
      epic: 'https://cdn.discordapp.com/emojis/1448004394707849287.png',
      nintendo: 'https://cdn.discordapp.com/emojis/1448004333298782208.png',
    };
    const platformNames = { psn: 'PlayStation', xbl: 'Xbox', epic: 'PC / Epic', nintendo: 'Nintendo Switch' };

    const embed = new EmbedBuilder()
      .setTitle(`Tes stats - ${linked.epic_display_name}`)
      .setColor(0x9d5bd2)
      .setThumbnail(interaction.user.displayAvatarURL());

    // Afficher la plateforme en author si connue
    if (linked.platform) {
      embed.setAuthor({
        name: platformNames[linked.platform] || linked.platform,
        iconURL: platformIcons[linked.platform],
      });
    }

    // Texte pour la période
    const periodText = seasonOnly ? `📅 ${SEASONS.current.shortName}` : '🌐 Lifetime';

    if (mode && GAME_MODES[mode]) {
      // Stats d'un mode spécifique
      const modeStats = stats.modes[GAME_MODES[mode].name];

      if (!modeStats || modeStats.matches === 0) {
        const periodMsg = seasonOnly ? ` cette saison (${SEASONS.current.shortName})` : '';
        return interaction.editReply({
          content: `❌ Tu n'as pas de stats en **${GAME_MODES[mode].name}**${periodMsg}.`,
        });
      }

      embed.setDescription(`**Mode:** ${GAME_MODES[mode].name} | ${periodText}`);
      embed.addFields(
        { name: '🏆 Victoires', value: `${modeStats.wins}`, inline: true },
        { name: '💀 Kills', value: `${modeStats.kills}`, inline: true },
        { name: '🎮 Parties', value: `${modeStats.matches}`, inline: true },
        { name: '📈 K/D', value: `${modeStats.kd}`, inline: true },
        { name: '🎯 Win Rate', value: `${modeStats.winRate}%`, inline: true },
      );
    } else {
      // Stats globales
      embed.setDescription(`**Stats globales (tous modes)** | ${periodText}`);
      embed.addFields(
        { name: '🏆 Victoires', value: `${stats.overall.wins}`, inline: true },
        { name: '💀 Kills', value: `${stats.overall.kills}`, inline: true },
        { name: '🎮 Parties', value: `${stats.overall.matches}`, inline: true },
        { name: '📈 K/D', value: `${stats.overall.kd}`, inline: true },
        { name: '🎯 Win Rate', value: `${stats.overall.winRate}%`, inline: true },
        { name: '⏱️ Temps joué', value: formatPlaytime(stats.overall.minutesPlayed), inline: true },
      );

      // Modes favoris (top 3, exclure les modes non-compétitifs)
      const excludedModes = ['playgroundv2', 'playground', 'creative'];
      const topModes = Object.entries(stats.modes)
        .filter(([name, m]) => m.matches > 0 && !excludedModes.some(ex => name.toLowerCase().includes(ex)))
        .sort((a, b) => b[1].matches - a[1].matches)
        .slice(0, 3);

      if (topModes.length > 0) {
        const modesText = topModes.map(([name, m]) =>
          `**${name}**: ${m.wins}W / ${m.kills}K (${m.winRate}%)`
        ).join('\n');
        embed.addFields({ name: '🎮 Tes modes favoris', value: modesText, inline: false });
      }
    }

    embed.setFooter({ text: seasonOnly ? `Stats ${SEASONS.current.name}` : 'Stats mises à jour toutes les 5 minutes' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (e) {
    console.error('Erreur me:', e);
    await interaction.editReply({
      content: `❌ Erreur: ${e.message}`,
    });
  }
}
