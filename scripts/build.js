/**
 * Unified Build Script
 * 
 * This script orchestrates the entire build process:
 * 1. Clean the dist directory
 * 2. Build the MCP client
 * 3. Build the extension
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const SCRIPTS_DIR = __dirname;

// Colors for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper to print status messages
function printStatus(message, status = 'info') {
  const prefix = {
    info: `${COLORS.blue}[INFO]${COLORS.reset}`,
    success: `${COLORS.green}[SUCCESS]${COLORS.reset}`,
    warning: `${COLORS.yellow}[WARNING]${COLORS.reset}`,
    error: `${COLORS.magenta}[ERROR]${COLORS.reset}`,
  };
  
  console.log(`${prefix[status]} ${message}`);
}

// Helper to execute shell commands
function executeCommand(command, cwd = ROOT_DIR, env = {}) {
  try {
    printStatus(`Executing: ${command}, Build Target: ${env.BUILD_TARGET}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    return true;
  } catch (error) {
    printStatus(`Command failed: ${error.message}`, 'error');
    return false;
  }
}

// Build the MCP client
function buildMcpClient(mode = 'production') {
  printStatus('Building MCP client...', 'info');
  
  // Ensure the target directories exist
  const MCP_SDK_DIR = path.join(SRC_DIR, 'mcpClient');  
  fs.mkdirSync(MCP_SDK_DIR, { recursive: true });
  
  // Build the browser-compatible version using the unified webpack config
  if (!executeCommand(
    `webpack --config ${path.join(SCRIPTS_DIR, 'webpack.config.js')} --mode=${mode}`,
    ROOT_DIR,
    { BUILD_TARGET: 'mcp', NODE_ENV: mode }
  )) {
    return false;
  }
  
  printStatus('MCP client built successfully', 'success');
  return true;
}

// Build the extension
function buildExtension(mode = 'production') {
  const isProduction = mode === 'production';
  printStatus(`Building extension in ${mode} mode...`, 'info');
  
  if (isProduction) {
    printStatus('Production build: Debug and info logs will be stripped', 'info');
  } else {
    printStatus('Development build: All logs will be preserved', 'info');
  }
  
  // Run webpack with the unified config
  if (!executeCommand(
    `webpack --config ${path.join(SCRIPTS_DIR, 'webpack.config.js')} --mode=${mode}`,
    ROOT_DIR,
    { BUILD_TARGET: 'extension', NODE_ENV: mode }
  )) {
    return false;
  }
  
  // Copy static assets
  copyAssets();
  
  printStatus(`Extension built successfully in ${mode} mode`, 'success');
  return true;
}

// Copy static assets
function copyAssets() {
  printStatus('Copying static assets...', 'info');
  
  // Create assets directory
  const ICONS_DIR = path.join(DIST_DIR, 'assets');
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  
  // Copy manifest.json
  fs.copyFileSync(
    path.join(ROOT_DIR, 'manifest.json'),
    path.join(DIST_DIR, 'manifest.json')
  );
  
  // Copy icons if they exist
  const SOURCE_ICONS_DIR = path.join(ROOT_DIR, 'assets');
  if (fs.existsSync(SOURCE_ICONS_DIR)) {
    fs.readdirSync(SOURCE_ICONS_DIR).forEach(file => {
      fs.copyFileSync(
        path.join(SOURCE_ICONS_DIR, file),
        path.join(ICONS_DIR, file)
      );
    });
  }
  
  printStatus('Assets copied successfully', 'success');
  return true;
}

// Clean dist directory
function cleanDist() {
  printStatus('Cleaning dist directory...', 'info');
  
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  
  fs.mkdirSync(DIST_DIR, { recursive: true });
  
  printStatus('Dist directory cleaned', 'success');
  return true;
}

// Main build function
async function build() {
  const startTime = Date.now();
  
  printStatus(`${COLORS.bright}Starting unified build process${COLORS.reset}`, 'info');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const mode = args.includes('--dev') ? 'development' : 'production';
  const skipMcp = args.includes('--skip-mcp');
  const skipClean = args.includes('--skip-clean');
  const skipExtension = args.includes('--skip-extension');
  
  // Execute build steps
  if (!skipClean && !cleanDist()) {
    process.exit(1);
  }
  
  if (!skipMcp && !buildMcpClient(mode)) {
    process.exit(1);
  }
  
  if (!skipExtension && !buildExtension(mode)) {
    process.exit(1);
  }
  
  const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
  printStatus(`${COLORS.bright}Build completed in ${buildTime}s${COLORS.reset}`, 'success');
}

// Run the build process
build().catch(error => {
  printStatus(`Build failed: ${error.message}`, 'error');
  process.exit(1);
}); 