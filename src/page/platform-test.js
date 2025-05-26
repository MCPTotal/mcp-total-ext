/**
 * Platform Adapter Test
 * Simple test to verify platform detection and selector functionality
 */

// Test the platform adapter
function testPlatformAdapter() {
  console.log('🧪 Testing Platform Adapter...');
  
  if (typeof platformAdapter === 'undefined') {
    console.error('❌ Platform adapter not available');
    return;
  }

  const adapter = platformAdapter;
  
  // Test platform detection
  const platform = adapter.getPlatform();
  const platformName = adapter.getPlatformName();
  console.log(`✅ Platform detected: ${platform} (${platformName})`);
  
  // Test selectors
  const selectors = adapter.getSelectors();
  console.log('✅ Selectors:', selectors);
  
  // Test DOM queries
  console.log('🔍 Testing DOM queries...');
  
  const userMessages = adapter.getUserMessages();
  console.log(`✅ Found ${userMessages.length} user messages`);
  if (userMessages.length > 0) {
    console.log('📝 First user message:', userMessages[0]);
  }
  
  const assistantMessages = adapter.getAssistantMessages();
  console.log(`✅ Found ${assistantMessages.length} assistant messages`);
  if (assistantMessages.length > 0) {
    console.log('📝 First assistant message:', assistantMessages[0]);
  }
  
  const inputArea = adapter.getInputArea();
  console.log('✅ Input area found:', !!inputArea);
  if (inputArea) {
    console.log('📝 Input area element:', inputArea);
  }
  
  const mainContainer = adapter.getMainContainer();
  console.log('✅ Main container found:', !!mainContainer);
  
  // Test API config
  const apiConfig = adapter.getApiConfig();
  console.log('✅ API config:', apiConfig);
  
  // Test message detection on specific elements
  if (userMessages.length > 0) {
    const isUser = adapter.isUserMessage(userMessages[0]);
    console.log(`✅ User message detection: ${isUser}`);
  }
  
  if (assistantMessages.length > 0) {
    const isAssistant = adapter.isAssistantMessage(assistantMessages[0]);
    console.log(`✅ Assistant message detection: ${isAssistant}`);
  }
  
  // Platform-specific tests
  if (platform === 'claude') {
    console.log('🔍 Claude-specific tests...');
    
    // Test Claude selectors
    const claudeUserContent = document.querySelectorAll('[data-testid="user-message"]');
    const claudeAssistantContent = document.querySelectorAll('[data-is-streaming="false"]');
    const proseMirror = document.querySelector('.ProseMirror[contenteditable="true"]');
    
    console.log(`✅ Claude user content elements: ${claudeUserContent.length}`);
    console.log(`✅ Claude assistant content elements: ${claudeAssistantContent.length}`);
    console.log(`✅ ProseMirror editor found: ${!!proseMirror}`);
    
  } else if (platform === 'chatgpt') {
    console.log('🔍 ChatGPT-specific tests...');
    
    // Test ChatGPT selectors
    const chatGPTUserMessages = document.querySelectorAll('[data-message-author-role="user"]');
    const chatGPTAssistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const promptTextarea = document.querySelector('#prompt-textarea');
    
    console.log(`✅ ChatGPT user messages: ${chatGPTUserMessages.length}`);
    console.log(`✅ ChatGPT assistant messages: ${chatGPTAssistantMessages.length}`);
    console.log(`✅ Prompt textarea found: ${!!promptTextarea}`);
  }
  
  console.log('🧪 Platform adapter test completed!');
  
  return {
    platform,
    platformName,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    inputArea: !!inputArea,
    mainContainer: !!mainContainer
  };
}

// Test network interception
function testNetworkInterception() {
  console.log('🧪 Testing Network Interception...');
  
  if (typeof toolManager === 'undefined') {
    console.error('❌ Tool manager not available');
    return;
  }
  
  const manager = toolManager;
  const adapter = platformAdapter;
  
  if (!adapter) {
    console.error('❌ Platform adapter not available in tool manager');
    return;
  }
  
  const platform = adapter.getPlatform();
  const apiConfig = adapter.getApiConfig();
  
  console.log(`✅ Platform: ${platform}`);
  console.log(`✅ API endpoint pattern: ${apiConfig.conversationEndpoint}`);
  
  // Test endpoint matching
  if (platform === 'claude') {
    const testUrls = [
      'https://claude.ai/api/organizations/12345/chat_conversations/67890/completion',
      'https://claude.ai/api/organizations/abcdef/chat_conversations/ghijkl/completion'
    ];
    
    testUrls.forEach(url => {
      const matches = adapter.isConversationEndpoint(url);
      console.log(`✅ URL "${url}" matches: ${matches}`);
    });
  } else if (platform === 'chatgpt') {
    const testUrls = [
      'https://chatgpt.com/backend-api/conversation',
      'https://chat.openai.com/backend-api/conversation'
    ];
    
    testUrls.forEach(url => {
      const matches = adapter.isConversationEndpoint(url);
      console.log(`✅ URL "${url}" matches: ${matches}`);
    });
  }
  
  console.log('🧪 Network interception test completed!');
}

// Also provide a quick status check
function checkPlatformStatus() {
  const adapter = platformAdapter;
  
  if (!adapter) {
    return { status: 'Not loaded', platform: 'unknown' };
  }
  
  return {
    status: 'Loaded',
    platform: adapter.getPlatform(),
    platformName: adapter.getPlatformName(),
    userMessages: adapter.getUserMessages().length,
    assistantMessages: adapter.getAssistantMessages().length,
    inputArea: !!adapter.getInputArea(),
  };
}; 

function main() {
    console.log(" -- Running platform tests --");
    testPlatformAdapter();
    console.log(" -- Running network interception tests --");
    testNetworkInterception();
    console.log(" -- Running platform status check --");
    checkPlatformStatus();
    console.log(" -- Platform tests completed --");
}

const paltformTest = {
    main,
  };
  
// Export for use in other modules
/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(paltformTest);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = paltformTest;
  }
}