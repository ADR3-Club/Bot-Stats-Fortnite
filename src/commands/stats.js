// src/commands/stats.js
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { findPlayer, getPlayerStats, getPlayerLevel, getAvailableModes, GAME_MODES, SEASONS } from '../services/epicStats.js';
import { getCachedStats, cacheStats, getLinkedAccount } from '../database/db.js';
import { renderStatsCard } from '../lib/renderStats.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Affiche les stats Fortnite d\'un joueur')
  .addStringOption(o => o
    .setName('mode')
    .setDescription('Mode de jeu')
    .setRequired(true)
    .addChoices(...getAvailableModes())
  )
  .addStringOption(o => o
    .setName('pseudo')
    .setDescription('Pseudo Epic Games (optionnel si compte lié)')
    .setRequired(false)
  )
  .addBooleanOption(o => o
    .setName('saison')
    .setDescription('Stats de la saison actuelle uniquement')
    .setRequired(false)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo');
  const mode = interaction.options.getString('mode', true);
  const seasonOnly = interaction.options.getBoolean('saison') || false;

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
        platform: linked.platform,
      };
    }

    // Options pour le filtrage par saison
    const statsOptions = seasonOnly ? { startTime: SEASONS.current.startTime } : {};

    // Vérifier le cache (seulement pour stats lifetime)
    let stats = seasonOnly ? null : getCachedStats(player.id);

    if (!stats) {
      // Récupérer les stats depuis l'API
      stats = await getPlayerStats(player.id, statsOptions);

      if (stats && !stats.private && !seasonOnly) {
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

    // Récupérer les stats du mode
    const modeConfig = GAME_MODES[mode];
    if (!modeConfig) {
      return interaction.editReply({
        content: `❌ Mode **${mode}** non reconnu.`,
      });
    }

    const modeStats = stats.modes[modeConfig.name];

    if (!modeStats || modeStats.matches === 0) {
      const periodMsg = seasonOnly ? ` cette saison (${SEASONS.current.shortName})` : '';
      return interaction.editReply({
        content: `❌ **${player.displayName}** n'a pas de stats en **${modeConfig.name}**${periodMsg}.`,
      });
    }

    // Période
    const period = seasonOnly ? SEASONS.current.shortName : 'Lifetime';

    // Récupérer le niveau du joueur
    const playerLevel = await getPlayerLevel(player.id);

    // Générer l'image avec l'avatar Discord de l'utilisateur
    const imageBuffer = await renderStatsCard({
      playerName: player.displayName,
      modeName: modeConfig.name,
      stats: modeStats,
      period,
      level: playerLevel,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
    });

    // Créer l'attachment
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `stats-${player.displayName.replace(/[^a-zA-Z0-9]/g, '')}-${mode}.png`,
    });

    await interaction.editReply({ files: [attachment] });

  } catch (e) {
    console.error('Erreur stats:', e);
    await interaction.editReply({
      content: `❌ Erreur: ${e.message}`,
    });
  }
}
