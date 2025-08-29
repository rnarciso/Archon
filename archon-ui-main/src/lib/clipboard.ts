
// Synchronous version for better compatibility
export const copyToClipboardSync = (text: string): boolean => {
  try {
    // Check if clipboard API is available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
      // For sync operations, we'll use execCommand but first try a workaround
      const input = document.createElement('input');
      input.value = text;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, 99999);
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(input);
        return successful;
      } catch (err) {
        document.body.removeChild(input);
        throw err;
      }
    }
    
    // Legacy fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Failed to copy text: ', error);
    return false;
  }
};

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    // First try the modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    
    // If not secure context or clipboard API not available, fallback to legacy methods
    throw new Error('Clipboard API not available in current context');
  } catch (err) {
    console.error('Failed to copy text with navigator.clipboard: ', err);
    
    // First fallback: Try creating a temporary input element and select it
    try {
      const input = document.createElement('input');
      input.value = text;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      input.setSelectionRange(0, 99999); // For mobile devices
      
      const successful = document.execCommand('copy');
      document.body.removeChild(input);
      
      if (successful) {
        return;
      }
    } catch (fallbackErr) {
      console.error('First fallback failed: ', fallbackErr);
    }
    
    // Second fallback: Use textarea method
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.opacity = '0';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return;
      }
    } catch (secondFallbackErr) {
      console.error('Second fallback failed: ', secondFallbackErr);
    }
    
    // If all methods fail, throw error
    throw new Error('All clipboard copy methods failed. Please copy manually.');
  }
};
