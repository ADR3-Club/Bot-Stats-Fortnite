// src/commands/debug.js - Commande temporaire pour débugger les playlists Epic
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getEpicClient, isEpicReady } from '../services/epicAuth.js';
import { findPlayer } from '../services/epicStats.js';
import { getLinkedAccount } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('debug-stats')
  .setDescription('[DEV] Affiche les playlists brutes retournées par Epic')
  .addStringOption(o => o
    .setName('pseudo')
    .setDescription('Pseudo Epic Games')
    .setRequired(false)
  );

export async function execute(interaction) {
  const pseudo = interaction.options.getString('pseudo');

  await interaction.deferReply({ flags: 64 }); // Ephemeral

  try {
    if (!isEpicReady()) {
      return interaction.editReply({ content: '❌ Client Epic non connecté' });
    }

    let accountId;
    let displayName;

    if (pseudo) {
      const player = await findPlayer(pseudo);
      if (!player) {
        return interaction.editReply({ content: `❌ Joueur **${pseudo}** non trouvé.` });
      }
      accountId = player.id;
      displayName = player.displayName;
    } else {
      const linked = getLinkedAccount(interaction.user.id);
      if (!linked) {
        return interaction.editReply({ content: '❌ Aucun compte lié.' });
      }
      accountId = linked.epic_account_id;
      displayName = linked.epic_display_name;
    }

    const client = getEpicClient();
    const rawStats = await client.getBRStats(accountId);

    if (!rawStats) {
      return interaction.editReply({ content: '❌ Pas de stats retournées (null).' });
    }

    // Extraire les playlists uniques
    const stats = rawStats?.data?.stats || {};
    const playlists = new Set();

    for (const key of Object.keys(stats)) {
      const match = key.match(/playlist_(.+)$/);
      if (match) playlists.add(match[1]);
    }

    const playlistList = [...playlists].sort().slice(0, 20).join('\n') || 'Aucune';

    const embed = new EmbedBuilder()
      .setTitle(`🔧 Debug Stats - ${displayName}`)
      .setColor(0xff9900)
      .addFields(
        { name: 'Account ID', value: accountId, inline: false },
        { name: `Playlists (${playlists.size})`, value: `\`\`\`\n${playlistList}\n\`\`\``, inline: false },
      )
      .setFooter({ text: 'Noms bruts des playlists Epic' });

    await interaction.editReply({ embeds: [embed] });

  } catch (e) {
    console.error('Debug error:', e);
    await interaction.editReply({ content: `❌ Erreur: ${e.message}` });
  }
}
