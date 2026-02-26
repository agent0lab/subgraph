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
  // graph build outputs to build/ but subgraph.yaml still has relative ABI paths
  // (e.g., ../../abis/X.json). Goldsky needs ABIs co-located in the build dir.
  const buildDir = path.join(ROOT_DIR, 'build');
  const abisDir = path.join(ROOT_DIR, 'abis');
  const buildAbisDir = path.join(buildDir, 'abis');

  // Copy abis/ into build/abis/
  if (!fs.existsSync(buildAbisDir)) {
    fs.mkdirSync(buildAbisDir, { recursive: true });
  }
  for (const file of fs.readdirSync(abisDir)) {
    fs.copyFileSync(path.join(abisDir, file), path.join(buildAbisDir, file));
  }

  // Rewrite ABI paths in build/subgraph.yaml to use local abis/ dir
  const manifestPath = path.join(buildDir, 'subgraph.yaml');
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/\.\.\/\.\.\/abis\//g, 'abis/');
  fs.writeFileSync(manifestPath, manifest);
}

function getNetworkConfig(deployment) {
  // Derive network name from deployment (e.g., "erc-8004-eth-sepolia" -> "eth-sepolia")
  const networkName = deployment.replace('erc-8004-', '');
  const configPath = path.join(NETWORKS_DIR, `${networkName}.json`);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getDeploymentInfo() {
  const deployment = process.env.DEPLOYMENT;
  const goldskyToken = process.env.GOLDSKY_TOKEN;

  if (!deployment) {
    log('\n❌ Error: DEPLOYMENT environment variable not set', 'red');
    log('\nUsage:', 'cyan');
    log('  GOLDSKY_TOKEN=<token> \\', 'yellow');
    log('  DEPLOYMENT=erc-8004-base-sepolia \\', 'yellow');
    log('  VERSION=1.0.0 \\', 'yellow');
    log('  npm run deploy:goldsky\n', 'yellow');
    process.exit(1);
  }

  if (!goldskyToken) {
    log('\n❌ Error: GOLDSKY_TOKEN environment variable not set', 'red');
    log('\nGet your API token from your Goldsky Project Settings page.', 'cyan');
    log('\nUsage:', 'cyan');
    log('  GOLDSKY_TOKEN=<token> \\', 'yellow');
    log('  DEPLOYMENT=erc-8004-base-sepolia \\', 'yellow');
    log('  npm run deploy:goldsky\n', 'yellow');
    process.exit(1);
  }

  // Verify deployment exists
  const manifestPath = path.join(OUTPUT_DIR, deployment, 'subgraph.yaml');
  if (!fs.existsSync(manifestPath)) {
    log(`\n❌ Error: Deployment manifest not found: ${manifestPath}`, 'red');
    log('\nAvailable deployments:', 'cyan');
    if (fs.existsSync(OUTPUT_DIR)) {
      const deployments = fs.readdirSync(OUTPUT_DIR).filter(f => {
        return fs.statSync(path.join(OUTPUT_DIR, f)).isDirectory();
      });
      deployments.forEach(d => log(`  - ${d}`, 'yellow'));
    }
    log('\nRun "npm run generate" to create deployment manifests.\n', 'cyan');
    process.exit(1);
  }

  // Load network config
  const networkConfig = getNetworkConfig(deployment);

  // Check Goldsky support
  if (networkConfig && networkConfig.goldsky && !networkConfig.goldsky.supported) {
    log(`\n❌ Error: ${networkConfig.displayName} is not supported on Goldsky`, 'red');
    log('This network does not have a matching Goldsky chain slug.\n', 'yellow');
    process.exit(1);
  }

  return {
    deployment,
    goldskyToken,
    manifestPath,
    networkConfig,
  };
}

function main() {
  log('\n🚀 Deploying to Goldsky\n', 'cyan');

  const { deployment, goldskyToken, manifestPath, networkConfig } = getDeploymentInfo();
  const version = process.env.VERSION || DEFAULT_VERSION;
  const tag = process.env.TAG;
  const goldskyName = deployment;

  // Display deployment info
  log('📋 Deployment Details:', 'bold');
  log(`   Deployment: ${deployment}`, 'cyan');
  log(`   Goldsky Name: ${goldskyName}/${version}`, 'cyan');
  if (tag) {
    log(`   Tag: ${tag}`, 'cyan');
  }
  if (networkConfig) {
    log(`   Network: ${networkConfig.displayName} (Chain ID: ${networkConfig.chainId})`, 'cyan');
  }
  log(`   Manifest: ${manifestPath}`, 'cyan');
  log('');

  try {
    // Build first — Goldsky requires pre-built subgraphs
    log('📦 Running codegen...', 'yellow');
    execSync(`graph codegen ${manifestPath}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    log('🔨 Building subgraph...', 'yellow');
    execSync(`graph build ${manifestPath}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    // Prepare build dir for Goldsky (copy ABIs, fix paths)
    prepareBuildForGoldsky();

    // Deploy to Goldsky
    log('🚢 Deploying to Goldsky...', 'green');
    log('');

    const buildDir = path.join(ROOT_DIR, 'build');
    let deployCmd = `goldsky subgraph deploy ${goldskyName}/${version} --path ${buildDir} --token ${goldskyToken}`;

    if (tag) {
      deployCmd += ` --tag ${tag}`;
    }

    execSync(deployCmd, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    log('');
    log('='.repeat(70), 'cyan');
    log('✅ Goldsky Deployment Successful!', 'green');
    log('='.repeat(70), 'cyan');
    log('');
    log(`📦 Subgraph: ${goldskyName}/${version}`, 'cyan');
    if (tag) {
      log(`🏷️  Tag: ${tag}`, 'cyan');
    }
    log('');
    log('💡 To tag this version for production:', 'yellow');
    log(`   goldsky subgraph tag create ${goldskyName}/${version} --tag prod --token $GOLDSKY_TOKEN`, 'yellow');
    log('');

  } catch (error) {
    log('');
    log('='.repeat(70), 'red');
    log('❌ Goldsky Deployment Failed', 'red');
    log('='.repeat(70), 'red');
    log('');

    if (error.message && error.message.includes('already exists')) {
      log('⚠️  This name/version already exists on Goldsky.', 'yellow');
      log('');
      log('Goldsky requires unique name/version pairs. Options:', 'cyan');
      log(`  1. Bump version:  VERSION=1.1.0 DEPLOYMENT=${deployment} npm run deploy:goldsky`, 'yellow');
      log(`  2. Delete old:    goldsky subgraph delete ${goldskyName}/${process.env.VERSION || DEFAULT_VERSION} --token $GOLDSKY_TOKEN`, 'yellow');
      log('');
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
