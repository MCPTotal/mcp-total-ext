// CSP-Friendly ChatGPT API Monitor

(function () {
  console.log('🔍 Initializing monitor script');

  // Create a separate script element with src to bypass CSP restrictions
  function createMonitorScript() {
    // Create an external script file in extension
    const script = document.createElement('script');

    // Use the unified monitor script
    script.src = chrome.runtime.getURL('src/page/monitor.js');
    console.log('🔍 Using unified monitor script');

    // Get extension base URL
    const extensionUrl = chrome.runtime.getURL('');

    // Listen for messages from the page script
    window.addEventListener('message', function (event) {
      // Only accept messages from the same frame
      if (event.source !== window) return;

      // Send extension URL when requested by debug monitor
      if (event.data && event.data.type === 'REQUEST_EXTENSION_URL') {
        console.log('🔍 Providing extension URL to debug monitor');
        window.postMessage({
          type: 'EXTENSION_URL',
          url: extensionUrl
        }, '*');
      }

      // Check if it's our message
      if (event.data && event.data.type === 'CONTENT_MESSAGE') {
        const action = event.data.action;
        const data = event.data.data;

        // Generic log of action and data
        console.log(`📡 ${action}:`, data);

        // Handle specific actions
        switch (action) {
          case 'LOADED':
            console.log('🔍 Content script loaded');
            break;
        }
      }
    });

    // Add the script to the page
    (document.head || document.documentElement).appendChild(script);
    console.log(`🔍 Monitor script (${script.src}) added to page`);
  }

  
  // Call this function to start the monitor
  createMonitorScript();

  // Post a message to check if the script was loaded
  setTimeout(() => {
    window.postMessage({ type: 'MONITOR_MESSAGE', action: 'ping' }, '*');
  }, 1000);

  console.log('🔍 Monitor script initialized');
})();
