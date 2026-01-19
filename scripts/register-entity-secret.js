/**
 * Script to register Circle Entity Secret
 * Run: node scripts/register-entity-secret.js YOUR_ENTITY_SECRET
 */

import { registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';

const entitySecret = process.argv[2];
const apiKey = process.env.CIRCLE_API_KEY;

if (!apiKey) {
  console.error('\n❌ Error: CIRCLE_API_KEY environment variable is required');
  console.log('Set it in your .env file or export it before running this script\n');
  process.exit(1);
}

if (!entitySecret) {
  console.error('\n❌ Error: Please provide your entity secret as an argument');
  console.log('Usage: node scripts/register-entity-secret.js YOUR_ENTITY_SECRET\n');
  process.exit(1);
}

if (entitySecret.length !== 64) {
  console.error('\n❌ Error: Entity secret should be 64 characters (32 bytes hex)');
  console.log(`Your input is ${entitySecret.length} characters\n`);
  process.exit(1);
}

console.log('\n=== REGISTERING ENTITY SECRET ===\n');
console.log('API Key:', apiKey.substring(0, 30) + '...');
console.log('Entity Secret:', entitySecret.substring(0, 10) + '...' + entitySecret.substring(54));

try {
  const response = await registerEntitySecretCiphertext({
    apiKey: apiKey,
    entitySecret: entitySecret,
    recoveryFileDownloadPath: '/Users/apple/Whatsapp agent',
  });

  console.log('\n✅ SUCCESS! Entity Secret registered.\n');
  console.log('Recovery file saved to: ./recovery-file.json');
  console.log('\n⚠️  IMPORTANT: Keep both your Entity Secret and recovery file safe!');
  console.log('Circle cannot recover these for you.\n');

  if (response.data?.recoveryFile) {
    console.log('Recovery File Data:', response.data.recoveryFile);
  }
} catch (error) {
  console.error('\n❌ Registration failed:', error.message);
  if (error.response?.data) {
    console.error('Details:', JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
}
