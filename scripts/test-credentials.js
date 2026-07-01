/**
 * Test Credential Storage System
 * 
 * Tests Windows Credential Manager integration
 */

const cloudConfig = require('../src/config/cloud-config');
const logger = require('../src/logger/logger');

async function test() {
  console.log('🧪 Testing AQURA Desktop Credential System\n');

  try {
    // Test 1: Parse .env file
    console.log('📄 Test 1: Parsing .env file...');
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../../.env');
    
    if (!fs.existsSync(envPath)) {
      console.log('⚠️  .env file not found at:', envPath);
      console.log('   Using mock credentials for testing...\n');
      
      var credentials = {
        url: 'https://supabase.urbanaqura.com',
        serviceKey: 'mock-service-key-for-testing'
      };
    } else {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      var credentials = cloudConfig.constructor.parseEnvFile(envContent);
      console.log('✅ Parsed credentials from .env file');
      console.log('   URL:', credentials.url);
      console.log('   Key:', credentials.serviceKey ? `${credentials.serviceKey.substring(0, 20)}...` : 'MISSING');
      console.log('');
    }

    // Test 2: Store credentials
    console.log('🔐 Test 2: Storing credentials in Windows Credential Manager...');
    await cloudConfig.setCredentials(credentials);
    console.log('✅ Credentials stored successfully\n');

    // Test 3: Retrieve credentials
    console.log('📥 Test 3: Retrieving credentials...');
    const retrieved = await cloudConfig.getCredentials();
    
    if (retrieved) {
      console.log('✅ Credentials retrieved successfully');
      console.log('   URL:', retrieved.url);
      console.log('   Key:', retrieved.serviceKey ? `${retrieved.serviceKey.substring(0, 20)}...` : 'MISSING');
      console.log('');
    } else {
      console.log('❌ Failed to retrieve credentials\n');
    }

    // Test 4: Connection test (only if real credentials)
    if (fs.existsSync(envPath) && retrieved) {
      console.log('🌐 Test 4: Testing connection to Supabase...');
      const testResult = await cloudConfig.constructor.testConnection(retrieved);
      
      if (testResult.success) {
        console.log('✅ Connection successful!');
        console.log('   Message:', testResult.message);
      } else {
        console.log('❌ Connection failed');
        console.log('   Message:', testResult.message);
      }
    } else {
      console.log('⏭️  Test 4: Skipped (using mock credentials)');
    }

    console.log('\n🎉 All tests completed!\n');
    console.log('📝 Credentials are stored in:');
    console.log('   1. Windows Credential Manager (keytar)');
    console.log('   2. Encrypted backup (electron-store)');
    console.log('\n✨ The credentials will persist across app restarts and updates!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
test();
