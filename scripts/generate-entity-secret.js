/**
 * Script to generate and register Circle Entity Secret
 * Run this ONCE to set up your entity secret
 */

import { generateEntitySecret, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';

// Step 1: Generate the entity secret
console.log('\n=== GENERATING ENTITY SECRET ===\n');
console.log('Your Entity Secret (SAVE THIS SECURELY):');
generateEntitySecret();

console.log('\n=== INSTRUCTIONS ===');
console.log('1. Copy the hex string printed above');
console.log('2. Save it somewhere safe (password manager)');
console.log('3. Run the registration script next with your entity secret');
console.log('\nTo register, create a new file or run:');
console.log('node scripts/register-entity-secret.js YOUR_ENTITY_SECRET_HERE\n');
