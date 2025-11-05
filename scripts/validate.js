#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const NETWORKS_DIR = path.join(ROOT_DIR, 'config', 'networks');
const DEPLOYMENT_FILE = path.join(ROOT_DIR, 'deployments', 'deployment.json');

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

function validateNetworkConfig(networkName, config) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!config.network) errors.push('Missing "network" field');
  if (!config.chainId) errors.push('Missing "chainId" field');
  if (!config.displayName) errors.push('Missing "displayName" field');

  // Registry configs
  const registries = ['identityRegistry', 'reputationRegistry', 'validationRegistry'];
  for (const registry of registries) {
    if (!config[registry]) {
      errors.push(`Missing "${registry}" configuration`);
    } else {
      if (!config[registry].address) {
        errors.push(`Missing "${registry}.address"`);
      } else {
        // Check address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(config[registry].address)) {
          errors.push(`Invalid address format for "${registry}.address": ${config[registry].address}`);
        }
      }
      if (config[registry].startBlock === undefined) {
        warnings.push(`Missing "${registry}.startBlock" (will default to 0)`);
      }
    }
  }

  // Graph node config
  if (!config.graphNode) {
    errors.push('Missing "graphNode" configuration');
  } else if (!config.graphNode.network) {
    errors.push('Missing "graphNode.network"');
  }

  return { errors, warnings };
}

function main() {
  log('\n🔍 Validating network configurations\n', 'cyan');

  let hasErrors = false;

  // Check if networks directory exists
  if (!fs.existsSync(NETWORKS_DIR)) {
    log('❌ Networks directory not found: ' + NETWORKS_DIR, 'red');
    process.exit(1);
  }

  // Get all network configs
  const networkFiles = fs.readdirSync(NETWORKS_DIR).filter(f => f.endsWith('.json'));

  if (networkFiles.length === 0) {
    log('❌ No network configuration files found', 'red');
    process.exit(1);
  }

  log(`Found ${networkFiles.length} network configurations\n`, 'green');

  // Validate each network config
  for (const file of networkFiles) {
    const networkName = file.replace('.json', '');
    const configPath = path.join(NETWORKS_DIR, file);

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const { errors, warnings } = validateNetworkConfig(networkName, config);

      if (errors.length > 0 || warnings.length > 0) {
        log(`\n📄 ${networkName} (${config.displayName || 'Unknown'})`, 'cyan');

        if (errors.length > 0) {
          hasErrors = true;
          log('   ❌ Errors:', 'red');
          errors.forEach(err => log(`      - ${err}`, 'red'));
        }

        if (warnings.length > 0) {
          log('   ⚠️  Warnings:', 'yellow');
          warnings.forEach(warn => log(`      - ${warn}`, 'yellow'));
        }
      } else {
        log(`✅ ${networkName} (${config.displayName})`, 'green');
      }
    } catch (error) {
      hasErrors = true;
      log(`\n❌ ${networkName}: Failed to parse JSON`, 'red');
      log(`   ${error.message}`, 'red');
    }
  }

  // Validate deployment.json if it exists
  if (fs.existsSync(DEPLOYMENT_FILE)) {
    log('\n🔍 Validating deployment.json\n', 'cyan');

    try {
      const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));

      if (!deployment['erc-8004']) {
        log('❌ Missing "erc-8004" entry in deployment.json', 'red');
        hasErrors = true;
      } else {
        const deployments = deployment['erc-8004'].deployments;
        const deploymentCount = Object.keys(deployments || {}).length;

        log(`✅ Found ${deploymentCount} deployment entries`, 'green');

        // Check that each deployment references a valid network config
        for (const [name, config] of Object.entries(deployments || {})) {
          const networkFile = `${config.network}.json`;
          if (!networkFiles.includes(networkFile)) {
            log(`⚠️  ${name}: references unknown network "${config.network}"`, 'yellow');
          }
        }
      }
    } catch (error) {
      log('❌ Failed to parse deployment.json', 'red');
      log(`   ${error.message}`, 'red');
      hasErrors = true;
    }
  } else {
    log('\n⚠️  deployment.json not found (optional)', 'yellow');
  }

  log('\n' + '='.repeat(70), 'cyan');

  if (hasErrors) {
    log('❌ Validation failed with errors', 'red');
    log('='.repeat(70) + '\n', 'cyan');
    process.exit(1);
  } else {
    log('✅ All validations passed!', 'green');
    log('='.repeat(70) + '\n', 'cyan');
  }
}

if (require.main === module) {
  main();
}
