/**
 * McpUI Module
 * Handles UI components for MCP server configuration
 */
class McpUI {
  constructor() {
    this.mcpManager = null;
    this._onShowServerConfigUI = null;
    this._activeModal = null; // Track the currently active modal
    this._escKeyListener = null; // Track ESC key listener
    
    // Define consistent color palette
    this.colors = {
      primary: '#4b5563',       // Main button color (slate gray)
      primaryLight: '#6b7280',  // Light variant for hover
      success: '#10b981',       // Success/enable actions
      successLight: '#34d399',  // Light variant for hover
      danger: '#ef4444',        // Danger/delete actions
      dangerLight: '#f87171',   // Light variant for hover
      info: '#3b82f6',          // Info/edit actions
      infoLight: '#60a5fa',     // Light variant for hover
      
      // UI colors
      border: '#e5e7eb',
      background: '#ffffff',
      backgroundLight: '#f9fafb',
      text: '#1f2937',
      textSecondary: '#6b7280',
      
      // Status colors
      statusEnabled: '#10b981',
      statusDisabled: '#ef4444'
    };
  }

  /**
   * Set the MCP Manager reference
   * @param {Object} mcpManager - The MCP Manager instance
   */
  setMcpManager(mcpManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Set the callback to show server config UI
   * @param {Function} callback - Function to call when shortcut is pressed
   */
  setShowServerConfigCallback(callback) {
    this._onShowServerConfigUI = callback;
  }

  /**
   * Shows a configuration UI for MCP servers
   * @returns {void}
   */
  showServerConfigUI() {
    if (!this.mcpManager) {
      console.error('📡 McpUI: No mcpManager reference set');
      return;
    }

    // Close any existing modal first
    this._closeActiveModal();

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    // Store reference to active modal
    this._activeModal = modal;
    
    // Detect if user is on Mac for shortcut display
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                 (navigator.userAgent.includes('Mac') && !navigator.userAgent.includes('Mobile'));
    const shortcutText = isMac ? 'Control+M' : 'Ctrl+M';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      width: 80%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    // Create heading
    const heading = document.createElement('h2');
    heading.textContent = 'MCP Server Configuration';
    heading.style.cssText = `
      margin-top: 0;
      color: #333;
      font-size: 18px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    // Add keyboard shortcut hint
    const shortcutHint = document.createElement('span');
    shortcutHint.textContent = shortcutText;
    shortcutHint.style.cssText = `
      font-size: 12px;
      color: #6b7280;
      font-weight: normal;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    `;
    heading.appendChild(shortcutHint);
    
    // Create server list
    const serverList = document.createElement('div');
    serverList.style.cssText = `
      margin-bottom: 15px;
    `;
    
    // Function to render server list
    const renderServerList = () => {
      serverList.innerHTML = '';
      
      if (this.mcpManager.servers.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'No servers configured.';
        emptyMsg.style.cssText = `
          color: #666;
          font-style: italic;
        `;
        serverList.appendChild(emptyMsg);
      } else {
        this.mcpManager.servers.forEach((server) => {
          const serverItem = document.createElement('div');
          serverItem.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border: 1px solid ${this.colors.border};
            border-radius: 4px;
            margin-bottom: 8px;
            background: ${server.enabled ? this.colors.backgroundLight : this.colors.background};
          `;
          
          const serverInfo = document.createElement('div');
          serverInfo.innerHTML = `
            <div style="font-weight: bold;">${server.id}</div>
            <div style="font-size: 12px; color: ${this.colors.textSecondary}; margin-top: 4px;">${server.url}</div>
            <div style="font-size: 12px; color: ${server.enabled ? this.colors.statusEnabled : this.colors.statusDisabled}; margin-top: 2px;">
              ${server.enabled ? '●' : '○'} ${server.enabled ? 'Enabled' : 'Disabled'}
            </div>
          `;
          
          const actionButtons = document.createElement('div');
          
          // Toggle button
          const toggleBtn = document.createElement('button');
          toggleBtn.textContent = server.enabled ? 'Disable' : 'Enable';
          toggleBtn.style.cssText = `
            background: ${server.enabled ? this.colors.danger : this.colors.success};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            margin-right: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s ease;
          `;
          toggleBtn.onclick = () => {
            this.mcpManager.setServerStatus(server.id, !server.enabled);
            renderServerList();
          };
          
          // Add hover effects for toggleBtn after creating it
          toggleBtn.addEventListener('mouseover', () => {
            toggleBtn.style.backgroundColor = server.enabled ? this.colors.dangerLight : this.colors.successLight;
          });
          
          toggleBtn.addEventListener('mouseout', () => {
            toggleBtn.style.backgroundColor = server.enabled ? this.colors.danger : this.colors.success;
          });
          
          // Edit button
          const editBtn = document.createElement('button');
          editBtn.textContent = 'Edit';
          editBtn.style.cssText = `
            background: ${this.colors.info};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            margin-right: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s ease;
          `;
          editBtn.onclick = () => {
            showServerForm(server);
          };
          
          // Add hover effects for editBtn after creating it
          editBtn.addEventListener('mouseover', () => {
            editBtn.style.backgroundColor = this.colors.infoLight;
          });
          
          editBtn.addEventListener('mouseout', () => {
            editBtn.style.backgroundColor = this.colors.info;
          });
          
          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.style.cssText = `
            background: ${this.colors.danger};
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s ease;
          `;
          deleteBtn.onclick = () => {
            if (confirm(`Are you sure you want to delete the server "${server.id}"?`)) {
              this.mcpManager.removeServer(server.id);
              renderServerList();
            }
          };
          
          // Add hover effects for deleteBtn after creating it
          deleteBtn.addEventListener('mouseover', () => {
            deleteBtn.style.backgroundColor = this.colors.dangerLight;
          });
          
          deleteBtn.addEventListener('mouseout', () => {
            deleteBtn.style.backgroundColor = this.colors.danger;
          });
          
          actionButtons.appendChild(toggleBtn);
          actionButtons.appendChild(editBtn);
          actionButtons.appendChild(deleteBtn);
          
          serverItem.appendChild(serverInfo);
          serverItem.appendChild(actionButtons);
          serverList.appendChild(serverItem);
        });
      }
    };
    
    // Create "Add Server" button
    const addButton = document.createElement('button');
    addButton.textContent = 'Add New MCP Server';
    addButton.style.cssText = `
      background: ${this.colors.primary};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: bold;
      width: 100%;
      margin-bottom: 20px;
      transition: background-color 0.2s ease;
    `;
    
    // Add hover effects for addButton after creating it
    addButton.addEventListener('mouseover', () => {
      addButton.style.backgroundColor = this.colors.primaryLight;
    });
    
    addButton.addEventListener('mouseout', () => {
      addButton.style.backgroundColor = this.colors.primary;
    });
    
    // Create form container (initially hidden)
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      display: none;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 20px;
      background: #f9fafb;
    `;
    
    // Function to show server form
    const showServerForm = (serverToEdit = null) => {
      const isEditing = !!serverToEdit;
      
      formContainer.innerHTML = `
        <h3 style="margin-top: 0; font-size: 16px;">${isEditing ? 'Edit' : 'Add'} MCP Server</h3>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Server ID:</label>
          <input type="text" id="server-id" ${isEditing ? 'disabled' : ''} 
            value="${isEditing ? serverToEdit.id : ''}" 
            style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
          <div style="font-size: 11px; color: #666; margin-top: 2px;">
            Unique identifier for this server. Cannot be changed once created.
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">Server URL:</label>
          <input type="text" id="server-url" 
            value="${isEditing ? serverToEdit.url : 'https://'}" 
            style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
          <div style="font-size: 11px; color: #666; margin-top: 2px;">
            Full URL to the MCP server endpoint (e.g., https://example.com/mcp)
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold;">API Key:</label>
          <input type="password" id="server-api-key" 
            value="${isEditing ? serverToEdit.apiKey : ''}" 
            style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
          <div style="font-size: 11px; color: #666; margin-top: 2px;">
            Authentication key for accessing the server (if required)
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="server-enabled" ${isEditing && serverToEdit.enabled ? 'checked' : ''} 
              style="margin-right: 6px;">
            <span>Enabled</span>
          </label>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
          <button id="cancel-btn" style="padding: 6px 12px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="save-btn" style="padding: 6px 12px; background: #8e44ad; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${isEditing ? 'Update' : 'Add'} Server
          </button>
        </div>
      `;
      
      formContainer.style.display = 'block';
      
      // Handle form submission
      document.getElementById('save-btn').onclick = async () => {
        const id = document.getElementById('server-id').value.trim();
        const url = document.getElementById('server-url').value.trim();
        const apiKey = document.getElementById('server-api-key').value.trim();
        const enabled = document.getElementById('server-enabled').checked;
        
        if (!id || !url) {
          alert('Server ID and URL are required.');
          return;
        }
        
        // Validate URL format
        try {
          new URL(url);
        } catch (e) {
          alert('Please enter a valid URL with protocol (e.g., https://example.com)');
          return;
        }
        
        // Create server config object
        const serverConfig = {
          id,
          url,
          apiKey,
          enabled
        };
        
        // Add or update server
        await this.mcpManager.addServer(serverConfig);
        
        // Hide form and refresh list
        formContainer.style.display = 'none';
        renderServerList();
      };
      
      // Handle cancel
      document.getElementById('cancel-btn').onclick = () => {
        formContainer.style.display = 'none';
      };

      // After setting formContainer.style.display = 'block'
      // Add this code to update the save button styling
      const saveBtn = document.getElementById('save-btn');
      saveBtn.style.backgroundColor = this.colors.primary;

      // Add hover effects for save button
      saveBtn.addEventListener('mouseover', () => {
        saveBtn.style.backgroundColor = this.colors.primaryLight;
      });

      saveBtn.addEventListener('mouseout', () => {
        saveBtn.style.backgroundColor = this.colors.primary;
      });
    };
    
    // Handle add button click
    addButton.onclick = () => {
      showServerForm();
    };
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background: ${this.colors.primary};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
      transition: background-color 0.2s ease;
    `;
    closeButton.onclick = () => {
      this._closeActiveModal();
    };
    
    // Add hover effects for closeButton after creating it
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.backgroundColor = this.colors.primaryLight;
    });
    
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.backgroundColor = this.colors.primary;
    });
    
    // Add keyboard shortcut hint to close button
    const escHint = document.createElement('span');
    escHint.textContent = 'ESC';
    escHint.style.cssText = `
      font-size: 10px;
      margin-left: 8px;
      background: rgba(255,255,255,0.2);
      padding: 2px 5px;
      border-radius: 3px;
      font-family: monospace;
    `;
    closeButton.appendChild(escHint);
    
    // Test connection button
    const testConnectionButton = document.createElement('button');
    testConnectionButton.textContent = 'Test All Connections';
    testConnectionButton.style.cssText = `
      background: ${this.colors.success};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 20px;
      width: 100%;
      transition: background-color 0.2s ease;
    `;
    testConnectionButton.onclick = async () => {
      testConnectionButton.textContent = 'Testing...';
      testConnectionButton.disabled = true;
      
      // Test each enabled server
      const results = [];
      for (const server of this.mcpManager.servers.filter(s => s.enabled)) {
        try {
          testConnectionButton.textContent = `Testing ${server.id}...`;
          const tools = await this.mcpManager.testServerConnection(server);
          const toolNames = tools.map(tool => tool.name).join(", ");
          results.push(`✅ ${server.id}: ${tools.length} tools found (${toolNames})`);
        } catch (error) {
          results.push(`❌ ${server.id}: ${error.message}`);
        }
      }
      
      // Display results
      alert('Connection Test Results:\n\n' + results.join('\n'));
      
      testConnectionButton.textContent = 'Test All Connections';
      testConnectionButton.disabled = false;
    };
    
    // Add hover effects for testConnectionButton after creating it
    testConnectionButton.addEventListener('mouseover', () => {
      testConnectionButton.style.backgroundColor = this.colors.successLight;
    });
    
    testConnectionButton.addEventListener('mouseout', () => {
      testConnectionButton.style.backgroundColor = this.colors.success;
    });
    
    // Assemble everything
    modalContent.appendChild(heading);
    modalContent.appendChild(addButton);
    modalContent.appendChild(formContainer);
    modalContent.appendChild(serverList);
    modalContent.appendChild(testConnectionButton);
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    
    // Initial render
    renderServerList();
    
    // Add to body
    document.body.appendChild(modal);
    
    // Setup ESC key handler
    this._setupEscKeyHandler();
  }
  
  /**
   * Setup ESC key handler to close modal
   * @private
   */
  _setupEscKeyHandler() {
    // Remove any existing ESC key listener
    this._removeEscKeyListener();
    
    // Add our ESC key listener
    this._escKeyListener = (event) => {
      if (event.key === 'Escape' && this._activeModal) {
        console.log('📡 ESC key pressed, closing MCP config UI');
        this._closeActiveModal();
        event.preventDefault();
      }
    };
    
    document.addEventListener('keydown', this._escKeyListener);
  }
  
  /**
   * Remove ESC key listener
   * @private
   */
  _removeEscKeyListener() {
    if (this._escKeyListener) {
      document.removeEventListener('keydown', this._escKeyListener);
      this._escKeyListener = null;
    }
  }
  
  /**
   * Close active modal if present
   * @private
   */
  _closeActiveModal() {
    if (this._activeModal && document.body.contains(this._activeModal)) {
      document.body.removeChild(this._activeModal);
      this._activeModal = null;
      this._removeEscKeyListener();
    }
  }

  /**
   * Setup keyboard shortcut (Ctrl+M on Windows, Control+M on Mac) to open server config
   */
  setupKeyboardShortcut() {
    if (!this._onShowServerConfigUI) {
      console.error('📡 McpUI: No callback set for showing server config UI');
      return;
    }

    // Detect if user is on Mac
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                 (navigator.userAgent.includes('Mac') && !navigator.userAgent.includes('Mobile'));
    
    // Define shortcut text for notification
    const shortcutText = isMac ? 'Control+M' : 'Ctrl+M';
    
    // Remove any existing listeners first (just in case)
    this._removeExistingKeydownListeners();
    
    // Add our keydown listener with a unique ID for potential cleanup
    this._keyDownListener = (event) => {
      // On Mac: event.ctrlKey is true when Control key is pressed
      // Make sure to use lowercase for the key check to handle all cases
      if (event.key.toLowerCase() === 'm' && event.ctrlKey) {
        console.log('📡 MCP keyboard shortcut detected', isMac ? 'on Mac' : 'on Windows/Linux');
        this._onShowServerConfigUI();
        // Prevent default browser behavior for this shortcut
        event.preventDefault();
      }
    };
    
    document.addEventListener('keydown', this._keyDownListener);
    console.log('📡 Keyboard shortcut registered: ' + shortcutText);
    
    // Show a temporary notification about the shortcut when first loaded
    setTimeout(() => {
      this.showShortcutNotification();
    }, 5000); // Show notification after 5 seconds to allow page to load
  }

  /**
   * Remove existing keyboard listeners to prevent duplicates
   * @private
   */
  _removeExistingKeydownListeners() {
    if (this._keyDownListener) {
      document.removeEventListener('keydown', this._keyDownListener);
      this._keyDownListener = null;
    }
  }

  /**
   * Show a temporary notification with the keyboard shortcut
   */
  showShortcutNotification() {
    // Detect if user is on Mac
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                 (navigator.userAgent.includes('Mac') && !navigator.userAgent.includes('Mobile'));
    
    // Define shortcut text for notification
    const shortcutText = isMac ? 'Control+M' : 'Ctrl+M';
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      transition: opacity 0.5s, transform 0.5s;
      opacity: 0;
      transform: translateY(20px);
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <b>MCP Tools Enabled</b>
      </div>
      <div>
        Press <kbd style="background: rgba(255,255,255,0.2); padding: 2px 5px; border-radius: 3px; font-family: monospace;">${shortcutText}</kbd> to configure MCP servers
      </div>
      <div style="margin-top: 5px; font-size: 12px; color: #ddd;">
        Press <kbd style="background: rgba(255,255,255,0.2); padding: 2px 5px; border-radius: 3px; font-family: monospace;">ESC</kbd> to close the settings
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification with animation after a short delay
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(20px)';
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 8000);
  }

  /**
   * Show a notification with a message
   * @param {string} message - Message to display
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 5000);
  }

  /**
   * Show notification about keyboard shortcut
   */
  showServerSelectionNotification() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                 (navigator.userAgent.includes('Mac') && !navigator.userAgent.includes('Mobile'));
    const shortcutText = isMac ? 'Control+M' : 'Ctrl+M';
    this.showNotification(`Press ${shortcutText} to configure MCP servers`);
  }
}

// Export the class
/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(McpUI);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = McpUI;
  }
}
/* eslint-enable no-undef */ 
