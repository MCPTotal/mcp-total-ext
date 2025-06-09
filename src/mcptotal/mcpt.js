// MCPTotal page script - Fetch spaces via API using Auth0 token
(function () {
  'use strict';

  console.log('🏠 MCPTotal page script loaded');

  // Function to find Auth0 token in localStorage

  // Function to send message to extension content script
  function sendToExtension(data) {
    // Use window.postMessage to communicate with content script
    // Content script will then use chrome.runtime.sendMessage to reach background
    window.postMessage({
      type: 'MCPT_UPDATE_LISTS',
      data: data
    }, '*');
  }


  let spacesDescription = null;

  async function monitorSpaces() {
    try {
      const currentSpacesDescription = sessionStorage.getItem('spaces-store');
      if (currentSpacesDescription !== spacesDescription) {
        spacesDescription = currentSpacesDescription;
        const spaces = await window.getSpacesEndpoints();
        console.log('🏠 Spaces:', spaces);
        sendToExtension(spaces);
      }
    } catch (error) {
      console.error('🏠 Error monitoring spaces:', error);
    }
  }
  setInterval(monitorSpaces, 2000);

})();
