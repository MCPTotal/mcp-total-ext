/**
 * Platform Adapter Module
 * Abstracts platform-specific elements for ChatGPT and Claude support
 */
class PlatformAdapter {
  constructor() {
    this.platform = this.detectPlatform();
    this.config = this.getPlatformConfig(this.platform);
    console.log(`🌐 Platform detected: ${this.platform}`);
  }

  /**
   * Detect current platform based on URL
   */
  detectPlatform() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('chatgpt.com')) {
      return 'chatgpt';
    } else if (hostname.includes('claude.ai')) {
      return 'claude';
    }
    
    console.warn('🌐 Unknown platform, defaulting to chatgpt');
    return 'chatgpt';
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig(platform) {
    const configs = {
      chatgpt: {
        name: 'ChatGPT',
        selectors: {
          userMessage: '[data-message-author-role="user"]',
          assistantMessage: '[data-message-author-role="assistant"]',
          inputArea: 'div[contenteditable="true"]#prompt-textarea',
          mainContainer: '[role="main"]',          
        },
        api: {
          conversationEndpoint: '/backend-api/conversation',
          method: 'POST'
        },        
      },
      
      claude: {
        name: 'Claude',
        selectors: {
          userMessage: '.font-user-message',
          assistantMessage: '.font-claude-message',
          inputArea: '.ProseMirror[contenteditable="true"], [data-testid="chat-input"], div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
          mainContainer: '.h-screen.flex.flex-col, main, [role="main"], .main-content',          
        },
        api: {
          conversationEndpoint: '/api/organizations/.*/chat_conversations/.*/completion',
          method: 'POST'
        },
      }
    };
    
    return configs[platform] || configs.chatgpt;
  }

  /**
   * Get current platform name
   */
  getPlatform() {
    return this.platform;
  }

  /**
   * Get platform display name
   */
  getPlatformName() {
    return this.config.name;
  }

  /**
   * Get platform-specific selectors
   */
  getSelectors() {
    return this.config.selectors;
  }

  /**
   * Get user message elements (enhanced for Claude)
   */
  getUserMessages() {
    const selector = this.config.selectors.userMessage;
    const elements = this._queryAllWithFallbacks(selector);
    return elements;
  }

  /**
   * Get assistant message elements (enhanced for Claude)
   */
  getAssistantMessages() {
    const selector = this.config.selectors.assistantMessage;
    const elements = this._queryAllWithFallbacks(selector);    
    return elements;
  }

  /**
   * Get input area element
   */
  getInputArea() {
    const selector = this.config.selectors.inputArea;
    let element = this._queryWithFallbacks(selector);
    
    return element;
  }

  /**
   * Get main container element
   */
  getMainContainer() {
    const selector = this.config.selectors.mainContainer;
    return this._queryWithFallbacks(selector);
  }

  /**
   * Query with multiple selectors as fallbacks
   */
  _queryWithFallbacks(selectorString) {
    const selectors = selectorString.split(',').map(s => s.trim());
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (e) {
        console.warn(`🌐 Invalid selector: ${selector}`, e);
      }
    }
    
    return null;
  }

  /**
   * Query all with multiple selectors as fallbacks (enhanced for Claude)
   */
  _queryAllWithFallbacks(selectorString) {
    const selectors = selectorString.split(',').map(s => s.trim());
    let foundElements = new Set();
    
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            // For other platforms, add elements directly
            elements.forEach(element => foundElements.add(element));
            break;
        }
      } catch (e) {
        console.warn(`🌐 Invalid selector: ${selector}`, e);
      }
    }
    
    return Array.from(foundElements);
  }

  /**
   * Check if element is a user message (enhanced for Claude structure)
   */
  isUserMessage(element) {
    if (!element || !element.getAttribute) return false;
    
    if (element.matches(this.config.selectors.userMessage)) {
      return true;
    }
    return false;
  }

  /**
   * Check if element is an assistant message (enhanced for Claude structure)
   */
  isAssistantMessage(element) {
    if (!element || !element.getAttribute) return false;
    
    if (element.matches(this.config.selectors.assistantMessage)) {
      return true;
    }
    return false;
  }

  /**
   * Find user message ancestor (enhanced for Claude structure)
   */
  findUserMessageAncestor(element) {
    let current = element;
    
    // Standard traversal for other platforms
    while (current && !this.isUserMessage(current)) {
        current = current.parentElement;
    }
    
    return current;
  }

  /**
   * Find assistant message ancestor (enhanced for Claude structure)
   */
  findAssistantMessageAncestor(element) {
    let current = element;
    
    // Standard traversal for other platforms
    while (current && !this.isAssistantMessage(current)) {
        current = current.parentElement;
    }
    
    return current;
  }


  hasExplicitToken(bodyData) {
    if (this.platform === 'chatgpt') {
        return bodyData.messages.some(msg => 
            msg.author?.role === 'user' && 
            msg.content?.parts?.[0]?.includes("MCPT")
          ) || false;
    } else if (this.platform === 'claude') {
      return bodyData.prompt.includes("MCPT");
    }
  }

  /**
   * Append system prompt to the request body
   */
  appendSystemPrompt(bodyData, systemPromptWithSeparator, toRemoveToken) {
    let userContent = '';
    if (this.platform === 'chatgpt') {
        const firstMessage = bodyData.messages.find(msg => msg.author.role === 'user');
        if (firstMessage) {          
            // Append our system prompt to the end of the user message
            // Remove MCPT token if present
            userContent = firstMessage.content.parts[0];
            if (toRemoveToken) {
                userContent = userContent.replace(toRemoveToken, "").trim();
            }
            firstMessage.content.parts[0] = userContent + "\n\n" + systemPromptWithSeparator;  
        }
    } else if (this.platform === 'claude') {
        userContent = bodyData.prompt;
        if (toRemoveToken) {
            userContent = userContent.replace(toRemoveToken, "").trim();
        }
        bodyData.prompt = userContent + "\n\n" + systemPromptWithSeparator;      
        
    }
    return bodyData;
  }

  getApiConfig() {
    return this.config.api;
  }

  /**
   * Check if URL matches conversation endpoint
   */
  isConversationEndpoint(url, method) {
    const conversationEndpoint = this.config.api.conversationEndpoint;
    const conversationMethod = this.config.api.method;
    if (method !== conversationMethod) {
      return false;
    }
    
    // Handle multiple patterns separated by pipes
    if (conversationEndpoint.includes('|')) {
      const patterns = conversationEndpoint.split('|');
      for (const pattern of patterns) {
        if (this._matchesEndpointPattern(url, pattern.trim())) {
          return true;
        }
      }
      return false;
    }
    
    return this._matchesEndpointPattern(url, conversationEndpoint);
  }

  /**
   * Check if URL matches a specific endpoint pattern
   */
  _matchesEndpointPattern(url, pattern) {
    // Handle wildcard patterns in endpoint
    if (pattern.includes('*') || pattern.includes('.')) {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch (e) {
        console.warn(`🌐 Invalid regex pattern: ${pattern}`, e);
        return url.includes(pattern.replace(/[.*]/g, ''));
      }
    }
    return url.includes(pattern);
  }
}

// Create singleton instance
const platformAdapter = new PlatformAdapter();

// Export for use in other modules
/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(platformAdapter);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = platformAdapter;
  }
}
/* eslint-enable no-undef */ 