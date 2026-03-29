#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const NETWORKS_DIR = path.join(ROOT_DIR, 'config', 'networks');
const OUTPUT_DIR = path.join(ROOT_DIR, 'deployments', 'generated');
const DEFAULT_VERSION = '1.0.0';

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

function prepareBuildForGoldsky() {
  const buildDir = path.join(ROOT_DIR, 'build');
  const abisDir = path.join(ROOT_DIR, 'abis');
  const buildAbisDir = path.join(buildDir, 'abis');

  if (!fs.existsSync(buildAbisDir)) {
    fs.mkdirSync(buildAbisDir, { recursive: true });
  }
  for (const file of fs.readdirSync(abisDir)) {
    fs.copyFileSync(path.join(abisDir, file), path.join(buildAbisDir, file));
  }

  const manifestPath = path.join(buildDir, 'subgraph.yaml');
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/\.\.\/\.\.\/abis\//g, 'abis/');
  fs.writeFileSync(manifestPath, manifest);
}

function loadNetworkConfigs() {
  const networkFiles = fs.readdirSync(NETWORKS_DIR).filter(f => f.endsWith('.json'));
  const configs = {};

  for (const file of networkFiles) {
    const networkName = file.replace('.json', '');
    const configPath = path.join(NETWORKS_DIR, file);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    configs[networkName] = config;
  }

  return configs;
}

function isDeployable(config) {
  // Must be Goldsky-supported
  if (!config.goldsky || !config.goldsky.supported) {
    return false;
  }

  // Must have contracts deployed (non-empty identityRegistry)
  if (!config.identityRegistry || !config.identityRegistry.address) {
    return false;
  }

  return true;
}

function main() {
  log('\n🚀 Deploying all subgraphs to Goldsky\n', 'cyan');

  const goldskyToken = process.env.GOLDSKY_TOKEN;
  const version = process.env.VERSION || DEFAULT_VERSION;
  const tag = process.env.TAG;

  if (!goldskyToken) {
    log('❌ Error: GOLDSKY_TOKEN environment variable not set', 'red');
    log('\nGet your API token from your Goldsky Project Settings page.', 'cyan');
    log('\nUsage:', 'cyan');
    log('  GOLDSKY_TOKEN=<token> VERSION=1.0.0 npm run deploy:goldsky:all\n', 'yellow');
    process.exit(1);
  }

  // Load all network configs
  const networkConfigs = loadNetworkConfigs();
  const networkNames = Object.keys(networkConfigs).sort();

  // Filter to deployable networks
  const deployable = [];
  const skipped = [];

  for (const name of networkNames) {
    const config = networkConfigs[name];
    if (isDeployable(config)) {
      deployable.push({ name, config });
    } else {
      const reason = !config.goldsky?.supported
        ? 'not supported on Goldsky'
        : 'no contracts deployed';
      skipped.push({ name, config, reason });
    }
  }

  log(`📊 Found ${networkNames.length} networks:`, 'cyan');
  log(`   ✅ Deployable: ${deployable.length}`, 'green');
  log(`   ⏭️  Skipped: ${skipped.length}`, 'yellow');
  log('');

  if (skipped.length > 0) {
    log('Skipping:', 'yellow');
    skipped.forEach(({ name, config, reason }) => {
      log(`   - ${config.displayName || name}: ${reason}`, 'yellow');
    });
    log('');
  }

  if (deployable.length === 0) {
    log('❌ No deployable networks found.', 'red');
    process.exit(1);
  }

  // Deploy each network
  const results = [];

  for (const { name, config } of deployable) {
    const deployment = `erc-8004-${name}`;
    const manifestPath = path.join(OUTPUT_DIR, deployment, 'subgraph.yaml');
    const goldskyName = deployment;

    if (!fs.existsSync(manifestPath)) {
      log(`⚠️  Skipping ${config.displayName}: manifest not found (run "npm run generate" first)`, 'yellow');
      results.push({ name, displayName: config.displayName, success: false, error: 'manifest not found' });
      continue;
    }

    try {
      log(`\n${'─'.repeat(70)}`, 'cyan');
      log(`🔨 Building & deploying ${config.displayName} (${goldskyName}/${version})...`, 'cyan');
      log(`${'─'.repeat(70)}`, 'cyan');

      // Codegen
      execSync(`graph codegen ${manifestPath}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      // Build
      execSync(`graph build ${manifestPath}`, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      // Prepare build dir for Goldsky (copy ABIs, fix paths)
      prepareBuildForGoldsky();

      // Deploy
      const buildDir = path.join(ROOT_DIR, 'build');
      let deployCmd = `goldsky subgraph deploy ${goldskyName}/${version} --path ${buildDir} --token ${goldskyToken}`;

      if (tag) {
        deployCmd += ` --tag ${tag}`;
      }

      execSync(deployCmd, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });

      log(`   ✅ ${config.displayName} deployed successfully`, 'green');
      results.push({ name, displayName: config.displayName, success: true });

    } catch (error) {
      log(`   ❌ ${config.displayName} failed to deploy`, 'red');
      results.push({ name, displayName: config.displayName, success: false, error: error.message });
    }
  }

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 Goldsky Deployment Summary\n', 'cyan');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`✅ Successful: ${successful.length}/${results.length}`, 'green');
  successful.forEach(r => {
    log(`   - ${r.displayName}`, 'green');
  });

  if (failed.length > 0) {
    log(`\n❌ Failed: ${failed.length}`, 'red');
    failed.forEach(r => {
      log(`   - ${r.displayName}: ${r.error}`, 'red');
    });
  }

  if (skipped.length > 0) {
    log(`\n⏭️  Skipped: ${skipped.length}`, 'yellow');
    skipped.forEach(({ config, reason }) => {
      log(`   - ${config.displayName}: ${reason}`, 'yellow');
    });
  }

  log('\n' + '='.repeat(70) + '\n', 'cyan');

  if (failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
