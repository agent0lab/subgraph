#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mustache = require('mustache');

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const NETWORKS_DIR = path.join(CONFIG_DIR, 'networks');
const TEMPLATE_FILE = path.join(CONFIG_DIR, 'subgraph.template.yaml');
const OUTPUT_DIR = path.join(ROOT_DIR, 'deployments', 'generated');
const DEPLOYMENT_FILE = path.join(ROOT_DIR, 'deployments', 'deployment.json');

// Colors for console output
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

function loadDeploymentConfig() {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    log('⚠️  deployment.json not found, skipping deployment config', 'yellow');
    return null;
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
}

function generateSubgraphManifest(networkName, networkConfig) {
  // Read template
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

  // Render template with network config
  const output = mustache.render(template, networkConfig);

  // Create output directory
  const outputPath = path.join(OUTPUT_DIR, `erc-8004-${networkName}`);
  fs.mkdirSync(outputPath, { recursive: true });

  // Write subgraph.yaml
  const manifestPath = path.join(outputPath, 'subgraph.yaml');
  fs.writeFileSync(manifestPath, output);

  return manifestPath;
}

function main() {
  log('\n🚀 Generating multi-chain subgraph manifests\n', 'cyan');

  // Check if template exists
  if (!fs.existsSync(TEMPLATE_FILE)) {
    log('❌ Template file not found: ' + TEMPLATE_FILE, 'red');
    process.exit(1);
  }

  // Load network configurations
  log('📁 Loading network configurations...', 'cyan');
  const networkConfigs = loadNetworkConfigs();
  const networkNames = Object.keys(networkConfigs).sort();

  if (networkNames.length === 0) {
    log('❌ No network configurations found in ' + NETWORKS_DIR, 'red');
    process.exit(1);
  }

  log(`   Found ${networkNames.length} networks: ${networkNames.join(', ')}\n`, 'green');

  // Load deployment config (optional)
  const deploymentConfig = loadDeploymentConfig();

  // Generate manifests for each network
  const results = [];
  for (const networkName of networkNames) {
    const config = networkConfigs[networkName];

    try {
      log(`📝 Generating manifest for ${config.displayName}...`, 'cyan');
      const manifestPath = generateSubgraphManifest(networkName, config);

      results.push({
        network: networkName,
        displayName: config.displayName,
        chainId: config.chainId,
        manifestPath: manifestPath,
        success: true
      });

      log(`   ✅ ${manifestPath}`, 'green');
    } catch (error) {
      log(`   ❌ Failed: ${error.message}`, 'red');
      results.push({
        network: networkName,
        displayName: config.displayName,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 Generation Summary\n', 'cyan');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`✅ Successfully generated: ${successful.length}/${results.length} manifests`, 'green');

  if (failed.length > 0) {
    log(`❌ Failed: ${failed.length}`, 'red');
    failed.forEach(r => {
      log(`   - ${r.network}: ${r.error}`, 'red');
    });
  }

  log('\n📍 Output directory: ' + OUTPUT_DIR, 'cyan');
  log('='.repeat(70) + '\n', 'cyan');

  // Exit with error if any failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { generateSubgraphManifest, loadNetworkConfigs };
