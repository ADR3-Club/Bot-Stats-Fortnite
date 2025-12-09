// src/commands/link.js
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { findPlayer } from '../services/epicStats.js';
import { linkAccount, getLinkedAccount, unlinkAccount } from '../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Lie ton compte Epic Games à Discord')
  .addSubcommand(sub => sub
    .setName('set')
    .setDescription('Lie ton compte Epic Games')
    .addStringOption(o => o
      .setName('pseudo')
      .setDescription('Ton pseudo Epic Games')
      .setRequired(true)
    )
    .addStringOption(o => o
      .setName('plateforme')
      .setDescription('Ta plateforme (optionnel)')
      .setRequired(false)
      .addChoices(
        { name: 'PlayStation', value: 'psn' },
        { name: 'Xbox', value: 'xbl' },
        { name: 'PC / Epic', value: 'epic' },
      )
    )
  )
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Supprime le lien avec ton compte Epic')
  )
  .addSubcommand(sub => sub
    .setName('status')
    .setDescription('Affiche ton compte Epic lié')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    const pseudo = interaction.options.getString('pseudo', true);
    const manualPlatform = interaction.options.getString('plateforme');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Rechercher le joueur
      const player = await findPlayer(pseudo);

      if (!player) {
        return interaction.editReply({
          content: `❌ Joueur **${pseudo}** non trouvé sur Epic Games.`,
        });
      }

      // Plateforme: priorité au manuel, sinon auto-détection (sauf 'epic' qui = null)
      const platform = manualPlatform === 'epic' ? null : (manualPlatform || player.platform || null);

      // Lier le compte
      linkAccount(interaction.user.id, player.id, player.displayName, platform);

      const platformNames = { psn: 'PlayStation', xbl: 'Xbox' };
      const embed = new EmbedBuilder()
        .setTitle('✅ Compte lié')
        .setDescription(`Ton compte Discord est maintenant lié à **${player.displayName}**`)
        .setColor(0x33b864)
        .addFields(
          { name: 'Pseudo Epic', value: player.displayName, inline: true },
          { name: 'ID Epic', value: player.id, inline: true },
        )
        .setFooter({ text: 'Utilise /me pour voir tes stats' });

      // Afficher la plateforme si connue
      if (platform) {
        embed.spliceFields(0, 0, {
          name: 'Plateforme',
          value: `🎮 ${platformNames[platform] || platform}`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (e) {
      await interaction.editReply({
        content: `❌ Erreur: ${e.message}`,
      });
    }
  }

  else if (subcommand === 'remove') {
    const linked = getLinkedAccount(interaction.user.id);

    if (!linked) {
      return interaction.reply({
        content: '❌ Tu n\'as pas de compte Epic lié.',
        flags: MessageFlags.Ephemeral,
      });
    }

    unlinkAccount(interaction.user.id);

    await interaction.reply({
      content: `✅ Compte **${linked.epic_display_name}** délié.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  else if (subcommand === 'status') {
    const linked = getLinkedAccount(interaction.user.id);

    if (!linked) {
      return interaction.reply({
        content: '❌ Tu n\'as pas de compte Epic lié.\nUtilise `/link set <pseudo>` pour en lier un.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const platformNames = { psn: 'PlayStation', xbl: 'Xbox' };
    const embed = new EmbedBuilder()
      .setTitle('🔗 Compte lié')
      .setColor(0x2391ec)
      .addFields(
        { name: 'Pseudo Epic', value: linked.epic_display_name, inline: true },
        { name: 'Lié le', value: new Date(linked.linked_at).toLocaleDateString('fr-FR'), inline: true },
      );

    // Afficher la plateforme si connue
    if (linked.platform) {
      embed.spliceFields(1, 0, {
        name: 'Plateforme',
        value: `🎮 ${platformNames[linked.platform] || linked.platform}`,
        inline: true,
      });
    }

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  }
}
