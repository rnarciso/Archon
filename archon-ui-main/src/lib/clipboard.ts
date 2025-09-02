// Enhanced clipboard utility with proper error handling and cross-platform compatibility

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

// Async version - preferred for modern browsers
export const copyToClipboard = async (text: string): Promise<ClipboardResult> => {
  try {
    // Check if clipboard API is available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }

    // Fallback to legacy method
    return copyToClipboardLegacy(text);
  } catch (error) {
    console.error('Failed to copy text with navigator.clipboard:', error);
    // Try legacy fallback if modern API fails
    return copyToClipboardLegacy(text);
  }
};

// Legacy fallback with improved cross-platform support
export const copyToClipboardLegacy = (text: string): ClipboardResult => {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Improved styling for better cross-platform compatibility
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.width = '1px';
    textArea.style.height = '1px';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    // Set attributes for better accessibility and iOS compatibility
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');
    textArea.setAttribute('tabindex', '-1');
    
    document.body.appendChild(textArea);
    
    // Enhanced selection for iOS Safari compatibility
    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textArea.setSelectionRange(0, text.length);
    } else {
      textArea.select();
      textArea.setSelectionRange(0, text.length);
    }
    
    // Execute copy command
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return { success: true };
    } else {
      return { 
        success: false, 
        error: 'Copy command failed - execCommand returned false' 
      };
    }
    
  } catch (error) {
    return { 
      success: false, 
      error: `Legacy copy failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

// Synchronous version with proper error handling
export const copyToClipboardSync = (text: string): ClipboardResult => {
  try {
    // Check if clipboard API is available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
      // For modern browsers, we'll use the async API but return immediately
      // Note: This won't provide immediate feedback on success/failure
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy text with navigator.clipboard:', err);
      });
      return { success: true }; // Optimistic return
    }

    // Use legacy fallback for immediate synchronous result
    return copyToClipboardLegacy(text);
    
  } catch (error) {
    console.error('Sync copy failed:', error);
    return copyToClipboardLegacy(text);
  }
};

// Utility function to check if clipboard is supported
export const isClipboardSupported = (): boolean => {
  return !!(
    (navigator.clipboard && window.isSecureContext) ||
    document.queryCommandSupported?.('copy')
  );
};

// Usage examples:
/*
// Async usage (recommended)
const result = await copyToClipboard("Hello World");
if (result.success) {
  console.log("Text copied successfully!");
} else {
  console.error("Copy failed:", result.error);
}

// Sync usage
const syncResult = copyToClipboardSync("Hello World");
if (syncResult.success) {
  console.log("Text copied successfully!");
} else {
  console.error("Copy failed:", syncResult.error);
}

// Check support
if (isClipboardSupported()) {
  // Proceed with copy functionality
} else {
  // Show alternative or disable copy feature
}
*/
