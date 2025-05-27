/**
 * ThemeManager Module
 * Handles theme detection and color management for dark/light modes
 */
class ThemeManager {
  constructor(platformAdapter) {
    this.platformAdapter = platformAdapter;
    this.currentTheme = 'light';
    this.themeChangeCallbacks = new Set();
    this.colors = this._getColorsForTheme(this.currentTheme);
    
    // Initialize theme detection
    // Observe changes to document.documentElement
    const waitForBodyAndDocument = () => {
      // Check if we have access to the document
      if (typeof document === 'undefined' || !document.documentElement || !document.body) {
        console.log('📡 Document not available yet, will try again in 500ms');
        setTimeout(waitForBodyAndDocument, 500);
        return;
      }
      this._detectInitialTheme();
      this._setupThemeListener();
    };
    waitForBodyAndDocument();
  }

  /**
   * Detect the initial theme based on platform-specific context
   */
  _detectInitialTheme() {
    let detectedTheme = 'light'; // default fallback

    if (this._detectTheme()) {
      detectedTheme = 'dark';
    }

    this.currentTheme = detectedTheme;
    this.colors = this._getColorsForTheme(this.currentTheme);
    console.log(`🎨 Theme initialized: ${this.currentTheme}`);
  }

  /**
   * Detect current theme by examining the page
   */
  _detectTheme() {
    try {
      // Check body or main container background colors
      const body = document.body;
      const bodyBg = window.getComputedStyle(body).backgroundColor;
      //console.log('🎨 Body background color:', bodyBg);
      
      if (this._isColorDark(bodyBg)) {
        //console.log('🎨 Dark mode theme detected via body background color');
        return true;
      }
    } catch (error) {
      console.warn('🎨 Error detecting theme:', error);
    }

    return false;
  }

  /**
   * Check if a color string represents a dark color
   */
  _isColorDark(colorString) {
    if (!colorString || colorString === 'transparent' || colorString === 'rgba(0, 0, 0, 0)') {
      return false;
    }
    
    try {
      // Convert color to RGB values
      const rgb = this._parseColor(colorString);
      if (!rgb) return false;
      
      // Calculate relative luminance
      const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
      return luminance < 0.5; // Dark if luminance is less than 50%
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse color string to RGB values
   */
  _parseColor(colorString) {
    // Handle rgb() and rgba() formats
    const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    
    // Handle hex colors
    const hexMatch = colorString.match(/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        // Convert 3-digit hex to 6-digit
        const expandedHex = hex.split('').map(c => c + c).join('');
        return {
          r: parseInt(expandedHex.substr(0, 2), 16),
          g: parseInt(expandedHex.substr(2, 2), 16),
          b: parseInt(expandedHex.substr(4, 2), 16)
        };
      } else {
        return {
          r: parseInt(hex.substr(0, 2), 16),
          g: parseInt(hex.substr(2, 2), 16),
          b: parseInt(hex.substr(4, 2), 16)
        };
      }
    }
    
    return null;
  }

  /**
   * Setup listener for platform-specific theme changes
   */
  _setupThemeListener() {
    // Watch for changes to the html element's class list
    if (typeof MutationObserver !== 'undefined') {
      this._themeObserver = new MutationObserver((mutations) => {
        let themeChanged = false;
            
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
            themeChanged = true;
          }
        });
            
        if (themeChanged) {
          const newThemeIsDark = this._detectTheme();
          const newTheme = newThemeIsDark ? 'dark' : 'light';
            
          if (newTheme !== this.currentTheme) {
            console.log('🎨 Theme change detected via MutationObserver');
            this._changeTheme(newTheme);
          }
        }
      });
        
      // Observe changes to document.documentElement
      this._themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
        
      // Also observe body for theme changes
      this._themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
      console.log('🎨 MutationObserver setup for theme changes');
    }
    
  }

  /**
   * Change the current theme and notify callbacks
   */
  _changeTheme(newTheme) {
    console.log(`🎨 Theme changed from ${this.currentTheme} to ${newTheme}`);
    this.currentTheme = newTheme;
    this.colors = this._getColorsForTheme(newTheme);
    
    // Notify all registered callbacks
    this.themeChangeCallbacks.forEach(callback => {
      try {
        callback(newTheme, this.colors);
      } catch (error) {
        console.error('🎨 Error in theme change callback:', error);
      }
    });
  }

  /**
   * Register a callback to be called when theme changes
   */
  onThemeChange(callback) {
    this.themeChangeCallbacks.add(callback);
    
    // Return an unsubscribe function
    return () => {
      this.themeChangeCallbacks.delete(callback);
    };
  }

  /**
   * Get the current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Get the current color palette
   */
  getColors() {
    return { ...this.colors };
  }

  /**
   * Get color scheme for a specific theme
   */
  _getColorsForTheme(theme) {
    if (theme === 'dark') {
      return {
        // Main action colors
        primary: '#6b7280',       // Main button color (lighter gray for dark mode)
        primaryLight: '#9ca3af',  // Light variant for hover
        success: '#10b981',       // Success/enable actions
        successLight: '#34d399',  // Light variant for hover
        danger: '#ef4444',        // Danger/delete actions
        dangerLight: '#f87171',   // Light variant for hover
        info: '#3b82f6',          // Info/edit actions
        infoLight: '#60a5fa',     // Light variant for hover
        purple: '#8b5cf6',        // Tool buttons (purple) - lighter for dark mode
        purpleLight: '#a78bfa',   // Light variant for hover
        
        // UI colors for dark theme
        border: '#4a5568',           // Medium gray borders
        background: '#1a202c',       // Very dark background
        backgroundLight: '#2d3748',  // Darker gray background
        backgroundInput: '#2d3748',  // Input field background
        backgroundModal: '#1a202c',  // Modal background
        backgroundHover: '#4a5568',  // Hover background
        text: '#f7fafc',             // Very light text
        textSecondary: '#cbd5e0',    // Secondary light text
        textPlaceholder: '#a0aec0',  // Placeholder text
        
        // Status colors
        statusEnabled: '#10b981',
        statusDisabled: '#ef4444',
        
        // Highlight colors
        highlightBg: '#4a5568',      // Medium gray background for highlights
        highlightText: '#a78bfa',    // Light purple text for highlights
        
        // Tool result specific colors
        resultBackground: '#2d3748',    // Darker gray-blue background
        resultBorder: '#4a5568',        // Medium gray border  
        resultBorderHover: '#718096',   // Lighter gray for hover
        resultText: '#e2e8f0'           // Light gray text
      };
    } else {
      return {
        // Main action colors
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
        
        // UI colors for light theme
        border: '#e5e7eb',
        background: '#ffffff',
        backgroundLight: '#f9fafb',
        backgroundInput: '#f8f9fa',
        backgroundModal: '#ffffff',
        backgroundHover: '#f3f4f6',
        text: '#1f2937',
        textSecondary: '#6b7280',
        textPlaceholder: '#9ca3af',
        
        // Status colors
        statusEnabled: '#10b981',
        statusDisabled: '#ef4444',
        
        // Highlight colors
        highlightBg: '#f3f4f6',
        highlightText: '#4f46e5',
        
        // Tool result specific colors
        resultBackground: '#f8f9fa',
        resultBorder: '#e9ecef',
        resultBorderHover: '#ced4da',
        resultText: '#1f2937'
      };
    }
  }

  /**
   * Cleanup observers and intervals
   */
  destroy() {
    if (this._themeObserver) {
      this._themeObserver.disconnect();
      this._themeObserver = null;
    }
    
    if (this._themePollingInterval) {
      clearInterval(this._themePollingInterval);
      this._themePollingInterval = null;
    }
    
    // Clear all callbacks
    this.themeChangeCallbacks.clear();
    
    console.log('🎨 ThemeManager destroyed');
  }


}

// Export for use in other modules
/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(ThemeManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
  }
}

/* eslint-enable no-undef */ 
