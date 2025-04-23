/**
 * Module Loader Utility
 * 
 * This provides a standardized way to expose modules for both CommonJS (webpack)
 * and direct browser usage in debug mode.
 * 
 * Usage:
 * 
 * At the end of each module file, add:
 * 
 * // Export the module
 * exposeModule(MyModuleName);
 */

// CommonJS module.exports equivalent that works in both environments
function exposeModule(moduleExport) {
  // For CommonJS environments (webpack bundling)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = moduleExport;
  }
  
  // For direct browser usage in debug mode
  // Get the script ID to expose this module with correct name
  const currentScript = document.currentScript;
  if (currentScript && currentScript.id) {
    window[currentScript.id] = moduleExport;
    console.log(`📡 Module exposed as window.${currentScript.id}`);
  }
}

// For direct browser usage in debug mode
// Get the script ID to expose this module with correct name
const currentScript = document.currentScript;
if (currentScript && currentScript.id) {
  window[currentScript.id] = { exposeModule };
} 