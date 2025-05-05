/**
 * Development Server
 * 
 * Provides a development environment with automatic rebuilding on file changes
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const webpack = require('webpack');

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

// Print status message
function printStatus(message, status = 'info') {
  const prefix = {
    info: `${COLORS.blue}[INFO]${COLORS.reset}`,
    success: `${COLORS.green}[SUCCESS]${COLORS.reset}`,
    warning: `${COLORS.yellow}[WARNING]${COLORS.reset}`,
    error: `${COLORS.magenta}[ERROR]${COLORS.reset}`,
  };
  
  console.log(`${prefix[status]} ${message}`);
}

// Development mode
process.env.NODE_ENV = 'development';
process.env.BUILD_TARGET = 'extension';

printStatus(`${COLORS.bright}Starting development server${COLORS.reset}`, 'info');

// Load webpack config
const webpackConfig = require('./webpack.config.js');

// Initialize webpack compiler
const compiler = webpack(webpackConfig);

// Function to compile using webpack
function runWebpack() {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        printStatus(`Webpack compilation error: ${err.message}`, 'error');
        reject(err);
        return;
      }
      
      if (stats.hasErrors()) {
        const info = stats.toJson();
        printStatus('Webpack compilation errors:', 'error');
        info.errors.forEach(error => {
          printStatus(error, 'error');
        });
        reject(new Error('Webpack compilation failed'));
        return;
      }
      
      printStatus(`Webpack build successful - ${new Date().toLocaleTimeString()}`, 'success');
      compiler.close((closeErr) => {
        if (closeErr) printStatus(`Error closing compiler: ${closeErr.message}`, 'error');
        resolve();
      });
    });
  });
}

// Watch for changes in the src directory
const watcher = chokidar.watch('src/**/*.js', {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});

// On file changes, recompile
watcher.on('change', async (filePath) => {
  printStatus(`File changed: ${filePath} - rebuilding...`, 'info');
  try {
    await runWebpack();
    
    // Create or update a timestamp file to signal to Chrome that the extension has changed
    const timestampPath = path.join(ROOT_DIR, 'extension-updated');
    fs.writeFileSync(timestampPath, new Date().toISOString());
    
    printStatus('Extension has been rebuilt', 'success');
  } catch (error) {
    printStatus(`Error during rebuild: ${error.message}`, 'error');
  }
});

// Initial build
runWebpack()
  .then(() => {
    printStatus(`${COLORS.bright}Watching for file changes in src/...${COLORS.reset}`, 'info');
  })
  .catch(err => {
    printStatus(`Initial build failed: ${err.message}`, 'error');
    process.exit(1);
  });
