// setup-auth.js - Génère les credentials Epic Games Device Auth
import fnbr from 'fnbr';
const { Client } = fnbr;
import { writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('='.repeat(60));
console.log('   Setup Epic Games Device Auth pour Bot-Stats-Fortnite');
console.log('='.repeat(60));
console.log();

if (existsSync('device_auth.json')) {
  console.log('device_auth.json existe déjà.');
  const overwrite = await question('Écraser ? (o/n): ');
  if (overwrite.toLowerCase() !== 'o') {
    console.log('Annulé.');
    rl.close();
    process.exit(0);
  }
}

console.log();
console.log('fnbr.js va te demander un code d\'autorisation.');
console.log('Un lien va s\'afficher, ouvre-le et connecte-toi.');
console.log();

try {
  const client = new Client({
    auth: {
      authorizationCode: async () => {
        const code = await Client.consoleQuestion('Entrez le code d\'autorisation: ');
        return code;
      },
    },
  });

  // Capturer les device auth générés
  client.on('deviceauth:created', (da) => {
    const deviceAuth = {
      accountId: da.accountId,
      deviceId: da.deviceId,
      secret: da.secret,
    };

    writeFileSync('device_auth.json', JSON.stringify(deviceAuth, null, 2));

    console.log();
    console.log('Device Auth généré avec succès !');
    console.log();
    console.log('Fichier créé: device_auth.json');
    console.log();
  });

  await client.login();

  console.log(`Connecté en tant que: ${client.user.self.displayName}`);
  console.log();

  await client.logout();

  console.log('Setup terminé ! Tu peux maintenant lancer le bot avec: npm start');

} catch (error) {
  console.error('Erreur:', error.message);

  if (error.message.includes('expired')) {
    console.log();
    console.log('Le code a expiré. Régénère-en un nouveau (valide 5 min).');
  }

  process.exit(1);
}

rl.close();
