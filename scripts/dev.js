const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const webpack = require('webpack');
const webpackConfig = require('../webpack.config.js');

// Set development mode
process.env.NODE_ENV = 'development';

console.log('🔍 Starting MCP Tools development server...');

// Initialize webpack compiler
const compiler = webpack(webpackConfig);

// Function to compile using webpack
function runWebpack() {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        console.error('❌ Webpack compilation error:', err);
        reject(err);
        return;
      }
      
      if (stats.hasErrors()) {
        const info = stats.toJson();
        console.error('❌ Webpack compilation errors:');
        info.errors.forEach(error => console.error(error));
        reject(new Error('Webpack compilation failed'));
        return;
      }
      
      console.log('✅ Webpack build successful -', new Date().toLocaleTimeString());
      compiler.close((closeErr) => {
        if (closeErr) console.error('Error closing compiler:', closeErr);
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
  console.log(`🔄 File changed: ${filePath} - rebuilding...`);
  try {
    await runWebpack();
    
    // Create or update a timestamp file to signal to Chrome that the extension has changed
    const timestampPath = path.join(__dirname, '../extension-updated');
    fs.writeFileSync(timestampPath, new Date().toISOString());
    
    // This is where we'd tell Chrome to reload the extension if possible
    console.log('🔄 Extension has been rebuilt.');
  } catch (error) {
    console.error('❌ Error during rebuild:', error);
  }
});

// Initial build
runWebpack()
  .then(() => {
    console.log('👀 Watching for file changes in src/...');
  })
  .catch(err => {
    console.error('❌ Initial build failed:', err);
    process.exit(1);
  }); 