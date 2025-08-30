
// Synchronous version for better compatibility
export const copyToClipboardSync = (text: string): boolean => {
  try {
    // Check if clipboard API is available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
      // For sync operations, we need to use a Promise-based approach
      // but we'll return false immediately and log any errors
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy text with navigator.clipboard: ', err);
      });
      return true; // Assume it will work since we're in a secure context
    }
    
    // Legacy fallback using execCommand
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      console.error('Failed to copy text with execCommand: ', err);
      return false;
    }
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
    
    // Fallback to legacy methods for non-secure contexts
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Position element off-screen
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    
    // Add to DOM
    document.body.appendChild(textArea);
    
    // Select and copy
    textArea.focus();
    textArea.select();
    
    // Try to copy
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      throw new Error('execCommand returned false');
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    // If all methods fail, throw error
    throw new Error('All clipboard copy methods failed. Please copy manually.');
  }
};
