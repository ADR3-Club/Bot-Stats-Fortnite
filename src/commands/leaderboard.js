// src/commands/leaderboard.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Affiche le classement des joueurs du serveur')
  .addStringOption(o => o
    .setName('stat')
    .setDescription('Stat à classer')
    .setRequired(false)
    .addChoices(
      { name: 'Victoires', value: 'wins' },
      { name: 'Kills', value: 'kills' },
      { name: 'K/D', value: 'kd' },
      { name: 'Parties', value: 'matches' },
    )
  );

export async function execute(interaction) {
  const stat = interaction.options.getString('stat') || 'wins';

  await interaction.deferReply();

  try {
    const leaderboardData = getLeaderboard(10);

    if (leaderboardData.length === 0) {
      return interaction.editReply({
        content: '📋 Aucun joueur lié sur ce serveur.\nUtilisez `/link set <pseudo>` pour apparaître dans le classement.',
      });
    }

    // Parser et trier par la stat choisie
    const players = leaderboardData
      .map(row => {
        const stats = JSON.parse(row.stats_json);
        return {
          discordId: row.discord_id,
          epicName: row.epic_display_name,
          wins: stats.overall?.wins || 0,
          kills: stats.overall?.kills || 0,
          kd: parseFloat(stats.overall?.kd) || 0,
          matches: stats.overall?.matches || 0,
        };
      })
      .sort((a, b) => b[stat] - a[stat]);

    const statLabels = {
      wins: '🏆 Victoires',
      kills: '💀 Kills',
      kd: '📈 K/D',
      matches: '🎮 Parties',
    };

    const embed = new EmbedBuilder()
      .setTitle(`🏅 Classement - ${statLabels[stat]}`)
      .setColor(0xf39c12)
      .setFooter({ text: 'Liez votre compte avec /link set pour apparaître' })
      .setTimestamp();

    const description = players.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const value = stat === 'kd' ? p[stat].toFixed(2) : p[stat].toLocaleString();
      return `${medal} **${p.epicName}** - ${value}`;
    }).join('\n');

    embed.setDescription(description || 'Aucune donnée');

    await interaction.editReply({ embeds: [embed] });

  } catch (e) {
    console.error('Erreur leaderboard:', e);
    await interaction.editReply({
      content: `❌ Erreur: ${e.message}`,
    });
  }
}
