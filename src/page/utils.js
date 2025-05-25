// ==============================
// Utility Functions
// ==============================

// Send a message back to the content script
function sendContentMessage(action, data) {
  window.postMessage(
    {
      type: 'CONTENT_MESSAGE',
      action: action,
      data: data,
    },
    '*'
  );
}

// Create the module exports
const utils = {
  sendContentMessage,
};

/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(utils);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
}
/* eslint-enable no-undef */
