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
  // Addresses/startBlocks are optional and may be managed outside this repo or provided for convenience.
  const registries = ['identityRegistry', 'reputationRegistry', 'validationRegistry'];
  for (const registry of registries) {
    if (!config[registry]) {
      warnings.push(`Missing "${registry}" configuration (ok if deployment details are managed elsewhere)`);
      continue;
    }
    if (config[registry].address !== undefined) {
      // Check address format (if provided)
      if (!/^0x[a-fA-F0-9]{40}$/.test(config[registry].address)) {
        errors.push(`Invalid address format for "${registry}.address": ${config[registry].address}`);
      }
    }
    // startBlock is optional; no validation required here
  }

  // Graph node config
  if (!config.graphNode) {
    errors.push('Missing "graphNode" configuration');
  } else if (!config.graphNode.network) {
    errors.push('Missing "graphNode.network"');
  }

  return { errors, warnings };
}

function validateConstantsFile(constantsContent, networkName, chainId, displayName) {
  const errors = [];
  const warnings = [];

  const chainIdStr = chainId != null ? chainId.toString() : '';
  const constNameMatch = constantsContent.match(new RegExp(`export\\s+const\\s+(\\w+)\\s*=\\s+"${networkName}"`));
  const constName = constNameMatch ? constNameMatch[1] : null;

  if (!constName) {
    errors.push(`constants.ts: missing Network entry for "${networkName}"`);
  } else {
    const chainIdPattern = new RegExp(`if\\s*\\(network\\s*==\\s*Network\\.${constName}\\)\\s*return\\s*BigInt\\.(fromI32\\(${chainIdStr}\\)|fromString\\("${chainIdStr}"\\))`);
    if (!chainIdPattern.test(constantsContent)) {
      errors.push(`constants.ts: missing chainId mapping for Network.${constName} -> ${chainIdStr}`);
    }

    if (displayName) {
      const displayNamePattern = new RegExp(`if\\s*\\(network\\s*==\\s*Network\\.${constName}\\)\\s*return\\s*"${displayName}"`);
      if (!displayNamePattern.test(constantsContent)) {
        errors.push(`constants.ts: displayName mismatch for Network.${constName} -> "${displayName}"`);
      }
    }
  }

  return { errors, warnings };
}

function validateContractAddressesFile(contractContent, chainId, displayName) {
  const errors = [];
  const warnings = [];

  const chainIdStr = chainId != null ? chainId.toString() : '';
  const contractChainIdPattern = new RegExp(`chainId\\.equals\\(BigInt\\.(fromI32\\(${chainIdStr}\\)|fromString\\("${chainIdStr}"\\))\\)`);
  if (!contractChainIdPattern.test(contractContent)) {
    errors.push(`contract-addresses.ts: missing chainId case for ${chainIdStr}`);
  }

  if (displayName) {
    const chainNamePattern = new RegExp(`if\\s*\\(chainId\\.equals\\(BigInt\\.(fromI32\\(${chainIdStr}\\)|fromString\\("${chainIdStr}"\\))\\)\\)\\s*return\\s*"${displayName}"`);
    if (!chainNamePattern.test(contractContent)) {
      errors.push(`contract-addresses.ts: displayName mismatch for chainId ${chainIdStr} -> "${displayName}"`);
    }
  }
  const supportedChainsPattern = new RegExp(`getSupportedChains\\(\\)[\\s\\S]*?BigInt\\.(fromI32\\(${chainIdStr}\\)|fromString\\("${chainIdStr}"\\))`);
  if (!supportedChainsPattern.test(contractContent)) {
    errors.push(`contract-addresses.ts: getSupportedChains missing chainId ${chainIdStr}`);
  }
  return { errors, warnings };
}

function validateChainFile(chainContent, networkName, chainId) {
  const errors = [];
  const warnings = [];

  const chainIdStr = chainId != null ? chainId.toString() : '';
  const chainMappingPattern = new RegExp(`network\\s*==\\s*"${networkName}"[\\s\\S]*?return\\s+${chainIdStr}`);
  if (!chainMappingPattern.test(chainContent)) {
    errors.push(`chain.ts: missing mapping for "${networkName}" -> ${chainIdStr}`);
  }

  return { errors, warnings };
};

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

  const constantsPath = path.join(ROOT_DIR, 'src', 'constants.ts');
  const contractsPath = path.join(ROOT_DIR, 'src', 'contract-addresses.ts');
  const chainsPath = path.join(ROOT_DIR, 'src', 'utils', 'chain.ts');

  if (!fs.existsSync(constantsPath)) {
    log(`❌ Required file not found: ${constantsPath}`, 'red');
    process.exit(1);
  }
  if (!fs.existsSync(contractsPath)) {
    log(`❌ Required file not found: ${contractsPath}`, 'red');
    process.exit(1);
  }
  if (!fs.existsSync(chainsPath)) {
    log(`❌ Required file not found: ${chainsPath}`, 'red');
    process.exit(1);
  }

  const constantsContent = fs.readFileSync(constantsPath, 'utf8');
  const contractsContent = fs.readFileSync(contractsPath, 'utf8');
  const chainsContent = fs.readFileSync(chainsPath, 'utf8');

  // Validate each network config
  for (const file of networkFiles) {
    const networkName = file.replace('.json', '');
    const configPath = path.join(NETWORKS_DIR, file);

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const { errors, warnings } = validateNetworkConfig(networkName, config);

      if (config.chainId && config.displayName && config.graphNode && config.graphNode.network) {
        const chainId = config.chainId.toString();
        const displayName = config.displayName;
        const graphNetwork = config.graphNode.network.toString();

        const constantsResult = validateConstantsFile(
          constantsContent,
          graphNetwork,
          chainId,
          displayName
        );
        const contractsResult = validateContractAddressesFile(
          contractsContent,
          chainId,
          displayName
        );
        const chainResult = validateChainFile(chainsContent, graphNetwork, chainId);

        errors.push(...constantsResult.errors, ...contractsResult.errors, ...chainResult.errors);
        warnings.push(...constantsResult.warnings, ...contractsResult.warnings, ...chainResult.warnings);
      }

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
