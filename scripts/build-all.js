#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'deployments', 'generated');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('\n🏗️  Building all subgraph deployments\n', 'cyan');

  // Check if generated directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    log('❌ No generated manifests found. Run "npm run generate" first.', 'red');
    process.exit(1);
  }

  // Get all deployment directories
  const deployments = fs.readdirSync(OUTPUT_DIR).filter(f => {
    const dirPath = path.join(OUTPUT_DIR, f);
    return fs.statSync(dirPath).isDirectory();
  });

  if (deployments.length === 0) {
    log('❌ No deployments found in ' + OUTPUT_DIR, 'red');
    process.exit(1);
  }

  log(`Found ${deployments.length} deployments\n`, 'green');

  const results = [];

  for (const deployment of deployments) {
    const manifestPath = path.join(OUTPUT_DIR, deployment, 'subgraph.yaml');

    if (!fs.existsSync(manifestPath)) {
      log(`⚠️  Skipping ${deployment}: no subgraph.yaml found`, 'yellow');
      continue;
    }

    try {
      log(`🔨 Building ${deployment}...`, 'cyan');

      // Run graph codegen
      execSync(`graph codegen ${manifestPath}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      });

      // Run graph build
      execSync(`graph build ${manifestPath}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      });

      log(`   ✅ Build successful\n`, 'green');
      results.push({ deployment, success: true });
    } catch (error) {
      log(`   ❌ Build failed\n`, 'red');
      results.push({ deployment, success: false, error: error.message });
    }
  }

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 Build Summary\n', 'cyan');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`✅ Successful builds: ${successful.length}/${results.length}`, 'green');

  if (failed.length > 0) {
    log(`❌ Failed builds: ${failed.length}`, 'red');
    failed.forEach(r => {
      log(`   - ${r.deployment}`, 'red');
    });
  }

  log('='.repeat(70) + '\n', 'cyan');

  if (failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
