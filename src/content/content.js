console.log('🔍 Initializing monitor script');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MCPT_SERVERS_UPDATED') {
    console.log('🔍 Received MCP servers update from background:', message.servers);
    
    // Forward the server list to the page monitor script
    window.postMessage({
      type: 'MCPT_SERVERS_UPDATED',
      servers: message.servers,
      source: message.source
    }, '*');
    
    sendResponse({ received: true });
  }
});


async function updateMcptServers(servers) {
  window.postMessage({
    type: 'MCPT_SERVERS_UPDATED',
    servers: servers,
    source: 'mcptotal.io'
  }, '*');
}

async function initMonitor() {
  setInterval(async () => {
    chrome.runtime.sendMessage({ type: 'GET_STORED_MCPT_SERVERS' }, (response) => {
      updateMcptServers(response.servers);
    });
  }, 2000);
}

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
          initMonitor();
          break;
      }
    }
  });

  // Add the script to the page
  (document.head || document.documentElement).appendChild(script);
  console.log(`🔍 Monitor script (${script.src}) added to page`);

  // Post a message to check if the script was loaded
  setTimeout(() => {
    window.postMessage({ type: 'MONITOR_MESSAGE', action: 'ping' }, '*');
  }, 1000);
  console.log('🔍 Monitor script initialized');
}

function initMcpTotal() {
  console.log('🔍 MCPTotal page detected');

  // Listen for messages from the page script
  window.addEventListener('message', function (event) {
    // Only accept messages from the same frame
    if (event.source !== window) return;

    // Send extension URL when requested by debug monitor
    if (event.data && event.data.type === 'MCPT_UPDATE_LISTS') {
      console.log('🔍 MCPT_UPDATE_LISTS', event.data);
      
      // Send the server configuration to background script for storage and distribution
      if (event.data.data && Array.isArray(event.data.data)) {
        chrome.runtime.sendMessage({
          type: 'STORE_MCPT_SERVERS',
          servers: event.data.data,
          source: 'mcptotal.io'
        }).then(response => {
          console.log('🔍 MCP servers stored:', response);
        }).catch(error => {
          console.error('🔍 Error storing MCP servers:', error);
        });
      }
    }
  });

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/mcptotal/mcpt.js');
  (document.head || document.documentElement).appendChild(script);
  console.log(`🔍 MCPTotal script (${script.src}) added to page`);
}

if (window.location.hostname === 'mcptotal.io') {
  initMcpTotal();
}
else {
  createMonitorScript();
}

