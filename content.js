// CSP-Friendly ChatGPT API Monitor

(function() {
  console.log('🔍 Starting CSP-friendly API monitor');
  
  // Create a separate script element with src to bypass CSP restrictions
  function createMonitorScript() {
    // Create an external script file in extension
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('monitor.js');
    
    // Listen for messages from the page script
    window.addEventListener('message', function(event) {
      // Only accept messages from the same frame
      if (event.source !== window) return;
      
      // Check if it's our message
      if (event.data && event.data.type === 'API_MONITOR') {
        console.log('📡 MESSAGE FROM PAGE SCRIPT:', event.data.action);
        
        if (event.data.data) {
          console.log('📡 DATA:', event.data.data);
        }
      }
    });
    
    // Add the script to the page
    (document.head || document.documentElement).appendChild(script);
    console.log('🔍 Monitor script added to page');
  }
  
  // Call this function to start the monitor
  createMonitorScript();
  
  // Post a message to check if the script was loaded
  setTimeout(() => {
    window.postMessage({ type: 'API_MONITOR_CHECK', action: 'ping' }, '*');
  }, 1000);
  
  console.log('🔍 API Monitor initialized (CSP-friendly version)');
})(); 