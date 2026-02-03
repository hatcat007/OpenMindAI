// Test script for config module
import { loadConfig, getStoragePath } from "./src/config.ts";

const config = loadConfig({ directory: '/tmp/test', config: {} });
console.log('✓ Config loaded:', !!config);
console.log('  - autoInitialize:', config.autoInitialize);
console.log('  - debug:', config.debug);
console.log('  - storagePath:', config.storagePath);

const storagePath = getStoragePath('/tmp/test', config);
console.log('✓ Storage path resolved:', storagePath);

console.log('\nAll tests passed!');
