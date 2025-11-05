#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DEPLOYMENT_FILE = path.join(ROOT_DIR, 'deployments', 'deployment.json');

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getDeploymentInfo() {
  // Get deployment name from env var
  const deployment = process.env.DEPLOYMENT;
  const studioSlug = process.env.STUDIO_SLUG;

  if (!deployment) {
    log('\n❌ Error: DEPLOYMENT environment variable not set', 'red');
    log('\nUsage:', 'cyan');
    log('  STUDIO_SLUG=erc-8004-testing-base-sepolia \\', 'yellow');
    log('  DEPLOYMENT=erc-8004-base-sepolia \\', 'yellow');
    log('  npm run deploy:studio\n', 'yellow');
    process.exit(1);
  }

  if (!studioSlug) {
    log('\n❌ Error: STUDIO_SLUG environment variable not set', 'red');
    log('\nUsage:', 'cyan');
    log('  STUDIO_SLUG=erc-8004-testing-base-sepolia \\', 'yellow');
    log('  DEPLOYMENT=erc-8004-base-sepolia \\', 'yellow');
    log('  npm run deploy:studio\n', 'yellow');
    process.exit(1);
  }

  // Verify deployment exists
  const manifestPath = path.join(ROOT_DIR, 'deployments', 'generated', deployment, 'subgraph.yaml');
  if (!fs.existsSync(manifestPath)) {
    log(`\n❌ Error: Deployment manifest not found: ${manifestPath}`, 'red');
    log('\nAvailable deployments:', 'cyan');
    const generatedDir = path.join(ROOT_DIR, 'deployments', 'generated');
    if (fs.existsSync(generatedDir)) {
      const deployments = fs.readdirSync(generatedDir).filter(f => {
        return fs.statSync(path.join(generatedDir, f)).isDirectory();
      });
      deployments.forEach(d => log(`  - ${d}`, 'yellow'));
    }
    log('\nRun "npm run generate" to create deployment manifests.\n', 'cyan');
    process.exit(1);
  }

  // Load deployment config for display info
  let networkInfo = null;
  try {
    const deploymentConfig = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const deploymentEntry = deploymentConfig['erc-8004']?.deployments?.[deployment];
    if (deploymentEntry) {
      networkInfo = {
        name: deploymentEntry.displayName || deploymentEntry.network,
        chainId: deploymentEntry.chainId,
        status: deploymentEntry.status
      };
    }
  } catch (err) {
    // Ignore - just won't show extra info
  }

  return {
    deployment,
    studioSlug,
    manifestPath,
    networkInfo
  };
}

function main() {
  log('\n🚀 Deploying to The Graph Studio\n', 'cyan');

  const { deployment, studioSlug, manifestPath, networkInfo } = getDeploymentInfo();

  // Display deployment info
  log('📋 Deployment Details:', 'bold');
  log(`   Deployment: ${deployment}`, 'cyan');
  log(`   Studio Slug: ${studioSlug}`, 'cyan');
  if (networkInfo) {
    log(`   Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`, 'cyan');
  }
  log(`   Manifest: ${manifestPath}`, 'cyan');
  log('');

  // Confirm deployment
  log('🔍 Validating manifest...', 'yellow');

  try {
    // Run graph codegen to ensure types are up to date
    log('📦 Running codegen...', 'yellow');
    execSync(`graph codegen ${manifestPath}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    log('🔨 Building subgraph...', 'yellow');
    execSync(`graph build ${manifestPath}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    log('🚢 Deploying to Studio...', 'green');
    log('');

    // Deploy to Studio (using Graph CLI v0.98+ syntax)
    execSync(`graph deploy ${studioSlug} ${manifestPath} --node https://api.studio.thegraph.com/deploy/`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    log('');
    log('='.repeat(70), 'cyan');
    log('✅ Deployment Successful!', 'green');
    log('='.repeat(70), 'cyan');
    log('');
    log(`🌐 View your subgraph: https://thegraph.com/studio/subgraph/${studioSlug}/`, 'cyan');
    log('');

  } catch (error) {
    log('');
    log('='.repeat(70), 'red');
    log('❌ Deployment Failed', 'red');
    log('='.repeat(70), 'red');
    log('');

    if (error.message.includes('not authenticated')) {
      log('⚠️  Authentication Error', 'yellow');
      log('');
      log('Run this command to authenticate:', 'cyan');
      log('  graph auth <YOUR_DEPLOY_KEY>', 'yellow');
      log('');
      log('Get your deploy key from: https://thegraph.com/studio/', 'cyan');
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
