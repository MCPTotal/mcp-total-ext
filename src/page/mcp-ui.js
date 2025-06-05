/**
 * McpUI Module
 * Handles UI components for MCP server configuration
 */
class McpUI {
  constructor(themeManager) {
    this.mcpManager = null;
    this._activeModal = null; // Track the currently active modal
    this._escKeyListener = null; // Track ESC key listener

    // Initialize theme manager - first check if it's available globally
    this.themeManager = themeManager;
    if (!this.themeManager) {
      console.warn('🎨 ThemeManager not available in McpUI, falling back to light theme');
      // Fallback to light theme colors if theme manager is not available
      this.colors = this._getFallbackColors();
    } else {
      // Use theme manager colors
      this.colors = this.themeManager.getColors();

      // Register for theme changes to update our colors
      this._themeUnsubscribe = this.themeManager.onThemeChange((theme, colors) => {
        console.log(`🎨 McpUI received theme change: ${theme}`);
        this.colors = colors;
      });
    }
  }

  /**
   * Fallback colors for when theme manager is not available
   */
  _getFallbackColors() {
    return {
      primary: '#4b5563',
      primaryLight: '#6b7280',
      success: '#10b981',
      successLight: '#34d399',
      danger: '#ef4444',
      dangerLight: '#f87171',
      info: '#3b82f6',
      infoLight: '#60a5fa',
      border: '#e5e7eb',
      background: '#ffffff',
      backgroundLight: '#f9fafb',
      backgroundInput: '#f8f9fa',
      backgroundModal: '#ffffff',
      backgroundHover: '#f3f4f6',
      text: '#1f2937',
      textSecondary: '#6b7280',
      statusEnabled: '#10b981',
      statusDisabled: '#ef4444'
    };
  }

  /**
   * Cleanup method to unsubscribe from theme changes
   */
  destroy() {
    if (this._themeUnsubscribe) {
      this._themeUnsubscribe();
    }
  }

  /**
   * Set the MCP Manager reference
   * @param {Object} mcpManager - The MCP Manager instance
   */
  setMcpManager(mcpManager) {
    this.mcpManager = mcpManager;
  }

  /**
   * Set the tool manager reference for automation preferences
   * @param {Object} toolManager - The ToolManager instance
   */
  setToolManager(toolManager) {
    this.toolManager = toolManager;
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
      background: ${this.colors.backgroundModal};
      color: ${this.colors.text};
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
    heading.textContent = 'MCP Servers';
    heading.style.cssText = `
      margin-top: 0;
      color: ${this.colors.text};
      font-size: 18px;
      border-bottom: 1px solid ${this.colors.border};
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
      color: ${this.colors.textSecondary};
      font-weight: normal;
      background: ${this.colors.backgroundLight};
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
          color: ${this.colors.textSecondary};
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
            background: ${server.enabled ? this.colors.backgroundLight : this.colors.backgroundModal};
            color: ${this.colors.text};
            ${!server.readonly ? 'cursor: pointer;' : ''}
            transition: background-color 0.2s ease;
          `;

          // Make entire item clickable for editing (non-readonly servers only)
          if (!server.readonly) {
            serverItem.addEventListener('click', (e) => {
              // Don't trigger edit if clicking on action buttons
              if (!e.target.closest('.action-buttons')) {
                showServerForm(server);
              }
            });

            // Add hover effect for editable items
            serverItem.addEventListener('mouseover', () => {
              serverItem.style.backgroundColor = this.colors.backgroundHover;
            });

            serverItem.addEventListener('mouseout', () => {
              serverItem.style.backgroundColor = server.enabled ? 
                this.colors.backgroundLight : this.colors.backgroundModal;
            });
          }

          const serverInfo = document.createElement('div');
          serverInfo.innerHTML = `
            <div style="font-weight: bold;">${server.name}</div>
            <div style="font-size: 12px; color: ${this.colors.textSecondary}; margin-top: 4px;">${server.url}</div>
          `;

          // Create container for status and automation (bottom row)
          const statusAutomationRow = document.createElement('div');
          statusAutomationRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 4px;
          `;

          // Create clickable status element
          const statusElement = document.createElement('div');
          statusElement.innerHTML = `${server.enabled ? '●' : '○'} ${server.enabled ? 'Enabled' : 'Disabled'}`;
          statusElement.title = server.enabled ? 'Click to disable' : 'Click to enable';
          statusElement.style.cssText = `
            font-size: 12px;
            color: ${server.enabled ? this.colors.statusEnabled : this.colors.statusDisabled};
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            display: inline-block;
            transition: background-color 0.2s ease;
          `;
          
          // Add click handler for status toggle
          statusElement.onclick = (e) => {
            e.stopPropagation(); // Prevent item click
            this.mcpManager.setServerStatus(server.name, !server.enabled);
            renderServerList();
          };

          // Add hover effects for status element
          statusElement.addEventListener('mouseover', () => {
            statusElement.style.backgroundColor = this.colors.backgroundHover;
          });

          statusElement.addEventListener('mouseout', () => {
            statusElement.style.backgroundColor = 'transparent';
          });

          // Create clickable automation element
          const automationElement = document.createElement('div');
          automationElement.innerHTML = `🔧 ${this.getAutomationDisplayText(server.automation || 'manual')}`;
          automationElement.title = 'Click to cycle automation modes';
          automationElement.style.cssText = `
            font-size: 11px;
            color: ${this.colors.textSecondary};
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            display: inline-block;
            transition: background-color 0.2s ease;
          `;
          
          // Add click handler for automation cycling
          automationElement.onclick = async (e) => {
            e.stopPropagation(); // Prevent item click
            
            // Cycle through automation modes: manual -> autorun -> autosend -> manual
            const currentMode = server.automation || 'manual';
            let nextMode;
            switch (currentMode) {
              case 'manual':
                nextMode = 'autorun';
                break;
              case 'autorun':
                nextMode = 'autosend';
                break;
              case 'autosend':
                nextMode = 'manual';
                break;
              default:
                nextMode = 'manual';
            }
            
            // Update server automation
            const updatedServer = { ...server, automation: nextMode };
            await this.mcpManager.addServer(updatedServer);
            
            // Apply automation preferences to existing tools from this server
            if (this.toolManager) {
              this.applyServerAutomationToTools(server.name, nextMode);
            }
            
            renderServerList();
          };

          // Add hover effects for automation element
          automationElement.addEventListener('mouseover', () => {
            automationElement.style.backgroundColor = this.colors.backgroundHover;
          });

          automationElement.addEventListener('mouseout', () => {
            automationElement.style.backgroundColor = 'transparent';
          });

          // Add status and automation to the row
          statusAutomationRow.appendChild(statusElement);
          statusAutomationRow.appendChild(automationElement);

          // Add the row to server info
          serverInfo.appendChild(statusAutomationRow);

          const actionButtons = document.createElement('div');
          actionButtons.className = 'action-buttons';
          actionButtons.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
          `;

          // Check if this server is read-only
          const isReadOnly = server.readonly === true;

          // Delete button - always show but disable for read-only servers
          const deleteBtn = document.createElement('button');
          deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
          deleteBtn.title = isReadOnly ? 'Cannot delete managed server' : 'Delete server';
          deleteBtn.disabled = isReadOnly;
          deleteBtn.style.cssText = `
            background: ${isReadOnly ? this.colors.textSecondary : this.colors.danger};
            color: ${isReadOnly ? this.colors.backgroundModal : 'white'};
            border: none;
            border-radius: 4px;
            padding: 6px;
            cursor: ${isReadOnly ? 'not-allowed' : 'pointer'};
            font-size: 12px;
            transition: background-color 0.2s ease;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: ${isReadOnly ? '0.5' : '1'};
          `;

          if (!isReadOnly) {
            deleteBtn.onclick = (e) => {
              e.stopPropagation(); // Prevent item click
              if (confirm(`Are you sure you want to delete the server "${server.name}"?`)) {
                this.mcpManager.removeServer(server.name);
                renderServerList();
              }
            };

            // Add hover effects for enabled delete button
            deleteBtn.addEventListener('mouseover', () => {
              deleteBtn.style.backgroundColor = this.colors.dangerLight;
            });

            deleteBtn.addEventListener('mouseout', () => {
              deleteBtn.style.backgroundColor = this.colors.danger;
            });
          }

          actionButtons.appendChild(deleteBtn);

          serverItem.appendChild(serverInfo);
          serverItem.appendChild(actionButtons);
          serverList.appendChild(serverItem);
        });
      }
    };

    // Create "Add Server" button
    const addButton = document.createElement('button');
    addButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
    addButton.title = 'Add new MCP server';
    addButton.style.cssText = `
      background: ${this.colors.primary};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      font-weight: bold;
      margin-right: 8px;
      transition: background-color 0.2s ease;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Add hover effects for addButton after creating it
    addButton.addEventListener('mouseover', () => {
      addButton.style.backgroundColor = this.colors.primaryLight;
    });

    addButton.addEventListener('mouseout', () => {
      addButton.style.backgroundColor = this.colors.primary;
    });

    // Test connection button
    const testConnectionButton = document.createElement('button');
    testConnectionButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    testConnectionButton.title = 'Test all connections';
    testConnectionButton.style.cssText = `
      background: ${this.colors.success};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: background-color 0.2s ease;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    testConnectionButton.onclick = async () => {
      // Store original content for restoration
      const originalContent = testConnectionButton.innerHTML;
      
      // Show loading state
      testConnectionButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';
      testConnectionButton.style.animation = 'spin 1s linear infinite';
      testConnectionButton.disabled = true;
      testConnectionButton.title = 'Testing connections...';

      // Add keyframes for spin animation if not already added
      if (!document.querySelector('#spin-keyframes')) {
        const style = document.createElement('style');
        style.id = 'spin-keyframes';
        style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }

      // Test each enabled server
      const results = [];
      const enabledServers = this.mcpManager.servers.filter(s => s.enabled);
      
      for (const server of enabledServers) {
        try {
          const tools = await this.mcpManager.testServerConnection(server);
          const toolNames = tools.map(tool => tool.name).join(', ');
          results.push(`✅ ${server.name}: ${tools.length} tools found (${toolNames})`);
        } catch (error) {
          results.push(`❌ ${server.name}: ${error.message}`);
        }
      }

      // Display results
      alert('Connection Test Results:\n\n' + results.join('\n'));

      // Restore button state
      testConnectionButton.innerHTML = originalContent;
      testConnectionButton.style.animation = '';
      testConnectionButton.disabled = false;
      testConnectionButton.title = 'Test all connections';
    };

    // Add hover effects for testConnectionButton
    testConnectionButton.addEventListener('mouseover', () => {
      if (!testConnectionButton.disabled) {
        testConnectionButton.style.backgroundColor = this.colors.successLight;
      }
    });

    testConnectionButton.addEventListener('mouseout', () => {
      if (!testConnectionButton.disabled) {
        testConnectionButton.style.backgroundColor = this.colors.success;
      }
    });

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeButton.title = 'Close (ESC)';
    closeButton.style.cssText = `
      background: ${this.colors.textSecondary};
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: background-color 0.2s ease;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => {
      this._closeActiveModal();
    };

    // Add hover effects for closeButton
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.backgroundColor = this.colors.primary;
    });

    closeButton.addEventListener('mouseout', () => {
      closeButton.style.backgroundColor = this.colors.textSecondary;
    });

    // Create container for action buttons
    const actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-top: 15px;
      padding: 10px 0;
      border-top: 1px solid ${this.colors.border};
    `;
    
    // Create right side container for add/test buttons
    const rightButtonsContainer = document.createElement('div');
    rightButtonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
    `;
    
    rightButtonsContainer.appendChild(addButton);
    rightButtonsContainer.appendChild(testConnectionButton);
    
    actionButtonsContainer.appendChild(closeButton);
    actionButtonsContainer.appendChild(rightButtonsContainer);

    // Create form container (initially hidden)
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      display: none;
      padding: 15px;
      border: 1px solid ${this.colors.border};
      border-radius: 4px;
      margin-bottom: 20px;
      background: ${this.colors.backgroundLight};
      color: ${this.colors.text};
    `;

    // Function to show server form
    const showServerForm = (serverToEdit = null) => {
      const isEditing = !!serverToEdit;

      formContainer.innerHTML = `
        <h3 style="margin-top: 0; font-size: 16px; color: ${this.colors.text};">${isEditing ? 'Edit' : 'Add'} MCP Server</h3>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${this.colors.text};">Server ID:</label>
          <input type="text" id="server-id" ${isEditing ? 'disabled' : ''} 
            value="${isEditing ? serverToEdit.name : ''}" 
            style="width: 100%; padding: 6px; border: 1px solid ${this.colors.border}; border-radius: 4px; background: ${this.colors.backgroundInput}; color: ${this.colors.text};">
          <div style="font-size: 11px; color: ${this.colors.textSecondary}; margin-top: 2px;">
            Unique identifier for this server. Cannot be changed once created.
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${this.colors.text};">Server URL:</label>
          <input type="text" id="server-url" 
            value="${isEditing ? serverToEdit.url : 'https://'}" 
            style="width: 100%; padding: 6px; border: 1px solid ${this.colors.border}; border-radius: 4px; background: ${this.colors.backgroundInput}; color: ${this.colors.text};">
          <div style="font-size: 11px; color: ${this.colors.textSecondary}; margin-top: 2px;">
            Full URL to the MCP server endpoint (e.g., https://example.com/mcp)
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${this.colors.text};">API Key:</label>
          <input type="password" id="server-api-key" 
            value="${isEditing ? serverToEdit.apiKey : ''}" 
            style="width: 100%; padding: 6px; border: 1px solid ${this.colors.border}; border-radius: 4px; background: ${this.colors.backgroundInput}; color: ${this.colors.text};">
          <div style="font-size: 11px; color: ${this.colors.textSecondary}; margin-top: 2px;">
            Authentication key for accessing the server (if required)
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 4px; font-weight: bold; color: ${this.colors.text};">Default Tool Automation:</label>
          <select id="server-automation" style="width: 100%; padding: 6px; border: 1px solid ${this.colors.border}; border-radius: 4px; background: ${this.colors.backgroundInput}; color: ${this.colors.text};">
            <option value="manual" ${isEditing && serverToEdit.automation === 'manual' ? 'selected' : ''}>Manual - Require clicks to run and send</option>
            <option value="autorun" ${isEditing && serverToEdit.automation === 'autorun' ? 'selected' : ''}>Auto-run - Automatically run, manually send</option>
            <option value="autosend" ${isEditing && serverToEdit.automation === 'autosend' ? 'selected' : ''}>Auto-run and send - Fully automatic</option>
          </select>
          <div style="font-size: 11px; color: ${this.colors.textSecondary}; margin-top: 2px;">
            Default automation behavior for all tools from this server. Can be overridden per tool.
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <label style="display: flex; align-items: center; cursor: pointer; color: ${this.colors.text};">
            <input type="checkbox" id="server-enabled" ${isEditing ? (serverToEdit.enabled ? 'checked' : '') : 'checked'} 
              style="margin-right: 6px;">
            <span>Enabled</span>
          </label>
        </div>
        
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
          <button id="cancel-btn" style="padding: 6px 12px; border: 1px solid ${this.colors.border}; background: ${this.colors.backgroundModal}; color: ${this.colors.text}; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="save-btn" style="padding: 6px 12px; background: ${this.colors.primary}; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${isEditing ? 'Save' : 'Add'} Server
          </button>
        </div>
      `;

      formContainer.style.display = 'block';

      // Handle form submission
      document.getElementById('save-btn').onclick = async () => {
        const id = document.getElementById('server-id').value.trim();
        const url = document.getElementById('server-url').value.trim();
        const apiKey = document.getElementById('server-api-key').value.trim();
        const automation = document.getElementById('server-automation').value;
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
          name: id,
          url,
          apiKey,
          automation,
          enabled
        };

        // Add or update server
        await this.mcpManager.addServer(serverConfig);
        
        // Apply automation preferences to all tools from this server
        if (this.toolManager) {
          this.applyServerAutomationToTools(id, automation);
        }

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

    // Assemble everything
    modalContent.appendChild(heading);
    modalContent.appendChild(formContainer);
    modalContent.appendChild(serverList);
    modalContent.appendChild(actionButtonsContainer);
    modal.appendChild(modalContent);

    // Initial render
    renderServerList();

    // Add to body
    document.body.appendChild(modal);

    // Add click-outside-to-close functionality
    modal.addEventListener('click', (e) => {
      // Only close if clicking on the modal backdrop (not the content)
      if (e.target === modal) {
        this._closeActiveModal();
      }
    });

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
      if (event.key && event.key === 'Escape' && this._activeModal) {
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
      // Add safety check to ensure event.key exists before calling toLowerCase()
      if (event.key && event.key.toLowerCase() === 'm' && event.ctrlKey) {
        console.log('📡 MCP keyboard shortcut detected', isMac ? 'on Mac' : 'on Windows/Linux');
        this.showServerConfigUI();
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
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 500);
    }, 8000);
  }

  /**
   * Apply server automation settings to all tools from that server
   * @param {string} serverId - The server ID
   * @param {string} automation - The automation mode (manual/autorun/autosend)
   */
  applyServerAutomationToTools(serverId, automation) {
    if (!this.toolManager) {
      console.warn('📡 McpUI: No toolManager reference set');
      return;
    }
    this.toolManager.updateServerAutomation(serverId, automation);
  }

  /**
   * Get automation display text based on the automation mode
   * @param {string} automation - The automation mode (manual/autorun/autosend)
   * @returns {string} - The display text for the automation mode
   */
  getAutomationDisplayText(automation) {
    switch (automation) {
      case 'manual':
        return 'Manual';
      case 'autorun':
        return 'Auto-run';
      case 'autosend':
        return 'Auto-run + send';
      default:
        return 'Manual';
    }
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
