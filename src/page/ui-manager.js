// ==============================
// UIManager Class
// ==============================
class UIManager {
  constructor() {
    // Store tool automation preferences
    this.toolPreferences = {};
    // Load preferences from localStorage on initialization
    this.loadToolPreferences();
    
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
      purple: '#6d28d9',        // Tool buttons (purple)
      purpleLight: '#7c3aed',   // Light variant for hover
      
      // UI colors
      border: '#e5e7eb',
      background: '#ffffff',
      backgroundLight: '#f9fafb',
      text: '#1f2937',
      textSecondary: '#6b7280',
      
      // Highlight colors
      highlightBg: '#f3f4f6',
      highlightText: '#4f46e5'
    };
  }

  // Load tool preferences from localStorage
  loadToolPreferences() {
    try {
      const savedPrefs = localStorage.getItem('mcpToolPreferences');
      if (savedPrefs) {
        this.toolPreferences = JSON.parse(savedPrefs);
        console.log('📡 Loaded tool preferences:', this.toolPreferences);
      }
    } catch (e) {
      console.error('📡 Error loading tool preferences:', e);
    }
  }

  // Save tool preferences to localStorage
  saveToolPreferences() {
    try {
      localStorage.setItem('mcpToolPreferences', JSON.stringify(this.toolPreferences));
    } catch (e) {
      console.error('📡 Error saving tool preferences:', e);
    }
  }

  // Get preferences for a specific tool
  getToolPreference(toolName) {
    return this.toolPreferences[toolName] || { mode: 'manual' };
  }

  // Set preferences for a specific tool
  setToolPreference(toolName, preferences) {
    this.toolPreferences[toolName] = {
      ...this.getToolPreference(toolName),
      ...preferences,
    };
    this.saveToolPreferences();
  }

  // Function to create the settings button with menu
  createSettingsButton(toolCall, toolButton) {
    // Create settings button (shown when send button is hidden)
    const settingsButton = document.createElement('button');
    settingsButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    settingsButton.title = 'Tool settings';
    settingsButton.style.cssText = `
      background-color: ${this.colors.primary};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-family-sans, system-ui, sans-serif);
      margin-left: 8px;
      width: 28px;
      height: 28px;
      align-items: center;
      justify-content: center;
      display: inline-block;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    `;

    // Create the settings menu
    const settingsMenu = this.createSettingsMenu(toolCall, toolButton);

    // Add settings button hover effects
    settingsButton.addEventListener('mouseover', () => {
      settingsButton.style.backgroundColor = this.colors.primaryLight;
    });

    settingsButton.addEventListener('mouseout', () => {
      settingsButton.style.backgroundColor = this.colors.primary;
    });

    // Add settings button click handler
    settingsButton.addEventListener('click', e => {
      e.stopPropagation(); // Prevent event bubbling

      // Toggle settings menu
      const isVisible = settingsMenu.style.display === 'block';
      settingsMenu.style.display = isVisible ? 'none' : 'block';

      // If opening the menu, refresh the button states based on current preference
      if (!isVisible) {
        this.updateSettingsMenuHighlighting(settingsMenu, toolCall);
      }
    });

    // Close settings menu when clicking outside
    document.addEventListener('click', e => {
      if (
        settingsMenu.style.display === 'block' &&
        !settingsMenu.contains(e.target) &&
        e.target !== settingsButton
      ) {
        settingsMenu.style.display = 'none';
      }
    });

    // Create a container for the settings button and menu
    const settingsContainer = document.createElement('div');
    settingsContainer.style.cssText = `
      position: relative;
    `;
    settingsContainer.appendChild(settingsButton);
    settingsContainer.appendChild(settingsMenu);

    return { settingsContainer, settingsButton };
  }

  // Create the settings menu with the three mode options
  createSettingsMenu(toolCall, toolButton) {
    const settingsMenu = document.createElement('div');
    settingsMenu.className = 'tool-settings-menu';
    settingsMenu.style.cssText = `
      background-color: white;
      border: 1px solid ${this.colors.border};
      border-radius: 6px;
      padding: 4px;
      margin-top: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: none;
      position: absolute;
      z-index: 1000;
      width: 180px;
      right: 0;
      max-height: 140px;
      overflow-y: auto;
    `;

    // Get current preferences
    const currentToolPrefs = this.getToolPreference(toolCall.tool);
    const currentMode = currentToolPrefs.mode || 'manual';

    // Use smaller icon size for a more compact look
    const iconSize = "12";
    
    // Create the three mode buttons with smaller icons
    const manualButton = this.createModeButton(
      'Manual',
      'manual',
      currentMode,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
      toolCall,
      toolButton
    );

    const autoRunButton = this.createModeButton(
      'Auto-run',
      'autorun',
      currentMode,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
      toolCall,
      toolButton
    );

    const autoSendButton = this.createModeButton(
      'Auto-run and send',
      'autosend',
      currentMode,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>`,
      toolCall,
      toolButton
    );

    // Add buttons to menu
    settingsMenu.appendChild(manualButton);
    settingsMenu.appendChild(autoRunButton);
    settingsMenu.appendChild(autoSendButton);

    return settingsMenu;
  }

  // Create a button option for the settings menu
  createModeButton(label, value, currentMode, icon, toolCall, toolButton) {
    const button = document.createElement('button');
    const isSelected = currentMode === value;

    button.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="margin-right: 8px; color: ${isSelected ? this.colors.highlightText : this.colors.textSecondary};">${icon}</span>
        <span>${label}</span>
      </div>
    `;
    button.value = value;

    // Highlight the currently selected mode
    button.style.cssText = `
      width: 100%;
      text-align: left;
      padding: 6px 8px;
      margin-bottom: 1px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      background-color: ${isSelected ? this.colors.highlightBg : 'transparent'};
      color: ${isSelected ? this.colors.highlightText : this.colors.text};
      font-weight: ${isSelected ? '500' : 'normal'};
      font-family: var(--font-family-sans, system-ui, sans-serif);
      transition: all 0.2s ease;
      height: 32px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    `;

    // Add hover effect
    button.addEventListener('mouseover', () => {
      button.style.backgroundColor = isSelected ? this.colors.highlightBg : this.colors.backgroundLight;
    });

    button.addEventListener('mouseout', () => {
      button.style.backgroundColor = isSelected ? this.colors.highlightBg : 'transparent';
    });

    // Click handler
    button.addEventListener('click', () => {
      // Save the preference
      this.setToolPreference(toolCall.tool, { mode: value });

      // Close the menu
      button.parentElement.style.display = 'none';

      // Apply the preference immediately
      console.log(`📡 Setting tool ${toolCall.tool} mode to ${value}`);

      if (value === 'autorun' || value === 'autosend') {
        // Run the tool if it's not already running
        if (!toolButton.disabled) {
          console.log(`📡 Auto-executing tool ${toolCall.tool} after mode change`);
          toolButton.click();
        }
      }
    });

    return button;
  }

  // Update the visual highlighting in the settings menu
  updateSettingsMenuHighlighting(settingsMenu, toolCall) {
    // Get the current preference
    const currentPref = this.getToolPreference(toolCall.tool);
    const currentMode = currentPref.mode || 'manual';

    // Update visual state of all buttons
    Array.from(settingsMenu.children).forEach(button => {
      if (button.value === currentMode) {
        // Selected option
        button.style.backgroundColor = this.colors.highlightBg;
        button.style.color = this.colors.highlightText;
        button.style.fontWeight = '500';

        // Update icon color
        const svgElement = button.querySelector('svg');
        if (svgElement) {
          svgElement.style.color = this.colors.highlightText;
        }
      } else {
        // Non-selected options
        button.style.backgroundColor = 'transparent';
        button.style.color = this.colors.text;
        button.style.fontWeight = 'normal';

        // Update icon color
        const svgElement = button.querySelector('svg');
        if (svgElement) {
          svgElement.style.color = this.colors.textSecondary;
        }
      }
    });
  }

  getToolCallElement(toolCall) {
    // Find all assistant message containers
    const messageContainers = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messageContainers.length === 0) {
      console.log('📡 No message containers found');
      return {};
    }

    // Start with the most recent message first
    // Iterate through message containers from newest to oldest
    let toolCallElement = null;
    let toolCallText = '';

    for (let i = messageContainers.length - 1; i >= 0 && i > messageContainers.length - 5; i--) {
      const latestMessage = messageContainers[i];
      console.log('* Looking for tool call:', toolCall.tool, 'in message', i);

      // Find paragraph elements that might contain tool calls
      const paragraphs = latestMessage.querySelectorAll('.markdown p, .prose p, .markdown pre, .prose pre');


      
      // Iterate through each paragraph
      for (let j = paragraphs.length - 1; j >= 0; j--) {
        const para = paragraphs[j];
        const text = para.textContent || '';
        console.log('   - Looking for tool call:', toolCall.tool, 'in paragraph', j, 'with text:', text);
        
        // Check if paragraph contains tool call markers
        if (text.includes('[TOOL_CALL]') && text.includes('[/TOOL_CALL]')) {
          console.log('📡 Found potential tool call paragraph');
          
          // For WhatsApp or any other tool, simply check if the tool name is in the text
          if (text.includes(`"tool": "${toolCall.tool}"`) || 
              text.includes(`"tool":"${toolCall.tool}"`)) {
            
            console.log('📡 Found matching tool call:', toolCall.tool);
            toolCallElement = para;
            
            // Extract the entire tool call text including the markers
            const startIndex = text.indexOf('[TOOL_CALL]');
            const endIndex = text.indexOf('[/TOOL_CALL]') + '[/TOOL_CALL]'.length;
            toolCallText = text.substring(startIndex, endIndex);
            return { toolCallElement, toolCallText };
            break;
          }
        }
      }
    }

    if (!toolCallElement) {
      console.log('📡 Could not find tool call element for:', toolCall.tool);
    } else {
      console.log('📡 Successfully found tool call element for:', toolCall.tool);
    }

    return { toolCallElement, toolCallText };
  }

  // Execute the tool and update UI accordingly
  async executeToolAndUpdateUI(
    toolCall,
    executeToolCall,
    toolButton,
    resultElement,
    settingsButton,
    sendButton,
    originalToolName,
    hasBeenExecuted,
    currentResult
  ) {
    // Prevent double execution during tool running
    if (hasBeenExecuted && toolButton.disabled) {
      console.log('📡 Tool already being executed, please wait');
      return null;
    }

    try {
      // Mark as in progress
      hasBeenExecuted = true;
      toolButton.disabled = true;

      // Change to loading state
      toolButton.textContent = 'Running...';

      // Execute tool and capture result
      let toolResult = executeToolCall(toolCall.tool, toolCall.parameters);

      // Handle promise result
      if (toolResult && typeof toolResult === 'object' && typeof toolResult.then === 'function') {
        console.log('📡 Tool returned a Promise, waiting for resolution');
        toolResult = await toolResult;
      }

      // Store the result
      currentResult = toolResult;

      // Update UI with result
      resultElement.style.color = '';
      const resultText =
        typeof currentResult === 'string' ? currentResult : JSON.stringify(currentResult, null, 2);
      resultElement.textContent = resultText;
      resultElement.style.display = 'block';

      // Show send button after successful execution
      sendButton.style.display = 'inline-block';
      // Hide settings button when send button is shown
      settingsButton.style.display = 'none';

      // Check if we should auto-send based on tool preferences
      const currentToolPrefs = this.getToolPreference(toolCall.tool);
      if (currentToolPrefs.mode === 'autosend') {
        console.log(`📡 Auto-sending result for tool ${toolCall.tool}`);
        // Small delay to let user see the result before sending
        setTimeout(() => {
          if (!sendButton.disabled) {
            sendButton.click();
          }
        }, 1000);
      }

      // Update button states and text
      if (toolButton.textContent.startsWith('Re-run')) {
        // Already has the "Re-run" prefix, don't add it again
        toolButton.textContent = originalToolName;
      } else {
        toolButton.textContent = 'Re-run ' + originalToolName;
      }
      toolButton.disabled = false;

      return { currentResult, hasBeenExecuted };
    } catch (e) {
      console.error('📡 Error executing tool:', e);
      resultElement.textContent = `Error: ${e.message}`;
      resultElement.style.display = 'block';
      resultElement.style.color = '#dc3545';

      // Re-enable button
      toolButton.disabled = false;
      toolButton.textContent = 'Retry';
      hasBeenExecuted = false;
      return { currentResult: null, hasBeenExecuted };
    }
  }

  drawToolResultButton(toolCall, executeToolCall) {
    const { toolCallElement, toolCallText } = this.getToolCallElement(toolCall);

    if (!toolCallElement) {
      console.log('📡 Could not find tool call text element');
      return;
    }

    // Format parameters for display
    const formatParams = () => {
      if (!toolCall.parameters || Object.keys(toolCall.parameters).length === 0) {
        return '';
      }

      const paramStr = Object.entries(toolCall.parameters)
        .map(([key, value]) => `${key}:${value}`)
        .join(', ');

      return `(${paramStr})`;
    };

    // Result display element
    const resultElement = document.createElement('pre');
    resultElement.style.cssText = `
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 6px;
      padding: 10px;
      margin-top: 8px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 180px;
      overflow-y: auto;
      display: none;
      margin-bottom: 4px;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      line-height: 1.5;
      min-height: 100px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      transition: border-color 0.2s;
    `;

    // Add visual cue on hover
    resultElement.addEventListener('mouseover', () => {
      resultElement.style.borderColor = '#ced4da';
    });

    resultElement.addEventListener('mouseout', () => {
      resultElement.style.borderColor = '#e9ecef';
    });

    // Create editable result textarea (initially hidden)
    const editableResult = document.createElement('textarea');
    editableResult.style.cssText = `
      background-color: #f8f9fa;
      border: 1px solid #ced4da;
      border-radius: 6px;
      padding: 10px;
      margin-top: 8px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      width: 100%;
      min-height: 100px;
      max-height: 200px;
      display: none;
      margin-bottom: 4px;
      resize: vertical;
      box-sizing: border-box;
      line-height: 1.5;
      overflow-y: auto;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      outline: none;
    `;

    // Make result clickable and toggle between view/edit modes
    resultElement.addEventListener('click', () => {
      editableResult.value = resultElement.textContent;
      resultElement.style.display = 'none';
      editableResult.style.display = 'block';
      editableResult.focus();
      editableResult.select();
    });

    // Add blur event to go back to view mode when focus is lost
    editableResult.addEventListener('blur', () => {
      resultElement.textContent = editableResult.value;
      editableResult.style.display = 'none';
      resultElement.style.display = 'block';
      currentResult = editableResult.value;
    });

    // Store the original tool name for later reuse
    const originalToolName = `${toolCall.tool}${formatParams()}`;

    // Create a unified tool button that combines the tool name and run functionality
    const toolButton = document.createElement('button');
    toolButton.textContent = originalToolName;
    toolButton.className = 'tool-run-button';
    toolButton.style.cssText = `
      background-color: ${this.colors.purple};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-family-sans, system-ui, sans-serif);
      margin-bottom: 8px;
      text-align: left;
      display: inline-block;
      align-items: center;
      transition: background-color 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    `;

    // Add hover effect
    toolButton.addEventListener('mouseover', () => {
      toolButton.style.backgroundColor = this.colors.purpleLight;
    });

    toolButton.addEventListener('mouseout', () => {
      toolButton.style.backgroundColor = this.colors.purple;
    });

    // Flag to track if the tool has been executed
    let hasBeenExecuted = false;
    let currentResult = null;

    // Create a send button (initially hidden)
    const sendButton = document.createElement('button');
    sendButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
    sendButton.title = 'Send result to chat';
    sendButton.style.cssText = `
      background-color: ${this.colors.purple};
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-family-sans, system-ui, sans-serif);
      margin-left: 8px;
      width: 28px;
      height: 28px;
      align-items: center;
      justify-content: center;
      display: none;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    `;

    // Create a settings button (shown when send button is hidden)
    const { settingsContainer, settingsButton } = this.createSettingsButton(toolCall, toolButton);

    // Add hover effect to send button
    sendButton.addEventListener('mouseover', () => {
      sendButton.style.backgroundColor = this.colors.purpleLight;
    });

    sendButton.addEventListener('mouseout', () => {
      sendButton.style.backgroundColor = this.colors.purple;
    });

    // Add click handler to the tool button
    toolButton.addEventListener('click', () => {
      // Reset button text to original if it's showing "Re-run"
      if (toolButton.textContent.startsWith('Re-run')) {
        toolButton.textContent = originalToolName;
      }

      // Reset any previous results
      resultElement.textContent = '';
      resultElement.style.color = '';
      resultElement.style.display = 'none';

      // Small delay then show loading indicator for better visual feedback
      setTimeout(() => {
        resultElement.style.display = 'block';
        resultElement.textContent = 'Running tool...';
        resultElement.style.color = '#6c757d';

        // Execute after a very short delay to allow visual transition
        setTimeout(async () => {
          const result = await this.executeToolAndUpdateUI(
            toolCall,
            executeToolCall,
            toolButton,
            resultElement,
            settingsButton,
            sendButton,
            originalToolName,
            hasBeenExecuted,
            currentResult
          );
          if (result) {
            currentResult = result.currentResult;
            hasBeenExecuted = result.hasBeenExecuted;
          }
        }, 50);
      }, 50);
    });

    // Add send button click handler
    sendButton.addEventListener('click', () => {
      if (currentResult !== null) {
        // Show sending feedback
        const originalBackground = sendButton.style.backgroundColor;
        const originalContent = sendButton.innerHTML;

        // Switch to a checkmark briefly to indicate success
        sendButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        sendButton.style.backgroundColor = '#10b981'; // Success green
        sendButton.disabled = true;

        // Send the result
        this.sendToolResult(toolCall, currentResult);

        // Hide result displays after sending
        setTimeout(() => {
          resultElement.style.display = 'none';
          editableResult.style.display = 'none';

          // Reset and hide the send button
          sendButton.innerHTML = originalContent;
          sendButton.style.backgroundColor = originalBackground;
          sendButton.disabled = false;
          sendButton.style.display = 'none';

          // Show settings button when send button is hidden
          settingsButton.style.display = 'inline-block';
        }, 2000);
      }
    });

    // Create a tools container with a button row
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      position: relative;
    `;

    // Settings menu container
    buttonRow.appendChild(toolButton);
    buttonRow.appendChild(sendButton);
    buttonRow.appendChild(settingsContainer);

    // Create a tools container
    const toolsContainer = document.createElement('div');
    toolsContainer.className = 'tool-buttons-container';
    toolsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 4px;
    `;

    // Add the components to the tools container
    toolsContainer.appendChild(buttonRow);
    toolsContainer.appendChild(resultElement);
    toolsContainer.appendChild(editableResult);

    // Now we need to specifically replace just that tool call, not the entire element
    if (toolCallText && toolCallElement) {
      // Create a placeholder element with a unique ID to replace the tool call text
      const placeholderId = `tool-placeholder-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const placeholder = `<div id="${placeholderId}"></div>`;

      console.log('=== Replacing tool call text:', toolCallText);
      console.log('=== Tool call element:', toolCallElement);
      // Replace only the specific tool call text with the placeholder
      const safeToolCallText = toolCallText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
      console.log('=== Safe tool call text:', safeToolCallText);
      const newHTML = toolCallElement.innerHTML.replace(
        new RegExp(safeToolCallText, 'g'),
        placeholder
      );

      // Update the element's HTML with the placeholder
      toolCallElement.innerHTML = newHTML;

      // Now find the placeholder and replace it with our actual UI
      const placeholderElement = document.getElementById(placeholderId);
      if (placeholderElement) {
        placeholderElement.appendChild(toolsContainer);
      } else {
        console.log(
          '📡 Could not find placeholder element, falling back to entire element replacement'
        );
        // Clear the element and add our new content
        toolCallElement.innerHTML = '';
        toolCallElement.appendChild(toolsContainer);
      }
    } else {
      // Fallback to replacing the entire element if we couldn't isolate the specific tool call
      console.log('📡 Could not isolate specific tool call text, replacing entire element');

      // Store the original text in a hidden element for reference
      const originalText = document.createElement('div');
      originalText.className = 'original-tool-call-text';
      originalText.style.display = 'none';
      originalText.textContent = toolCallElement.textContent;

      // Clear the element and add our new content
      toolCallElement.innerHTML = '';
      toolCallElement.appendChild(originalText);
      toolCallElement.appendChild(toolsContainer);
    }

    // Auto-run the tool if preferences are set
    const savedToolPrefs = this.getToolPreference(toolCall.tool);
    if (savedToolPrefs.mode === 'autorun' || savedToolPrefs.mode === 'autosend') {
      console.log(`📡 Auto-running tool ${toolCall.tool} (mode: ${savedToolPrefs.mode})`);
      // Execute with a slight delay to allow the UI to render first
      setTimeout(() => {
        // This would trigger the tool button click
        console.log(`📡 Auto-executing tool ${toolCall.tool}`);
        toolButton.click();
      }, 500);
    }
  }

  // Inject a button into the UI to send the tool result
  injectToolResultButton(toolCall, executeToolCall) {
    try {
      console.log(`📡 Injecting button for tool: ${toolCall.tool}`);
      this.drawToolResultButton(toolCall, executeToolCall);
    } catch (e) {
      console.error('📡 Error injecting button:', e);
    }
  }

  // Send the tool result as a new user message through the UI
  async sendToolResult(toolCall, result) {
    try {
      console.log('📡 Sending tool result via UI for:', toolCall.tool);

      // Find the contenteditable div that serves as the input field
      const inputElement =
        document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
        document.querySelector('div[contenteditable="true"]');

      // Format the result message with params included
      const paramsStr = this.formatParameters(toolCall.parameters);
      const resultMessage = `Tool result for ${toolCall.tool}${paramsStr}:\n${result}`;

      // Enter the result into the message box and preserve newlines
      inputElement.focus();
      
      // Preserve newlines by using innerHTML with <br> tags
      const formattedMessage = '<p>' + resultMessage.replace(/\n/g, '</p><p>') + '</p>';
      console.log('📡 Formatted message:', formattedMessage);
      inputElement.innerHTML = formattedMessage;
      
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));

      // Simulate pressing Enter to send the message
      setTimeout(() => {
        inputElement.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          })
        );

        console.log('📡 Simulated Enter key to send tool result');
      }, 100);

      console.log('📡 Tool result submission initiated');
    } catch (e) {
      console.error('📡 Error sending tool result via UI:', e);
      this.injectErrorMessage(`Error sending tool result: ${e.message}`);
    }
  }

  // Format parameters for display
  formatParameters(parameters) {
    if (!parameters || Object.keys(parameters).length === 0) {
      return '';
    }

    const paramStr = Object.entries(parameters)
      .map(([key, value]) => `${key}:${value}`)
      .join(', ');

    return `(${paramStr})`;
  }

  // Inject an error message into the UI
  injectErrorMessage(message) {
    try {
      // Create error message element
      const errorDiv = document.createElement('div');
      errorDiv.className = 'tool-error-message';
      errorDiv.textContent = message;
      errorDiv.style.cssText = `
        background-color: #fee2e2;
        color: ${this.colors.danger};
        padding: 10px;
        margin: 10px 0;
        border-radius: 4px;
        border: 1px solid ${this.colors.danger};
        font-size: 14px;
      `;

      // Find the chat content area to inject the message
      const chatContainer = document.querySelector('[role="main"]');
      if (chatContainer) {
        chatContainer.prepend(errorDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
          try {
            errorDiv.remove();
          } catch (e) {
            // Ignore errors during cleanup - element might already be removed
          }
        }, 10000);
      }
    } catch (e) {
      console.error('📡 Error injecting error message:', e);
    }
  }
}

// Export the class
/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(UIManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
  }
}
/* eslint-enable no-undef */
