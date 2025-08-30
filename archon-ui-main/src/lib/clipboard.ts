
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
    
    // Legacy fallback using execCommand with improved macOS compatibility
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.style.zIndex = '-1000';
    textArea.style.whiteSpace = 'pre'; // Preserve formatting
    
    // Ensure the element is focused before selection
    document.body.appendChild(textArea);
    
    // Force a reflow to ensure proper rendering
    void textArea.offsetWidth;
    
    // Set selection range for better macOS compatibility
    // For very long text, use a smaller selection range
    const selectionEnd = Math.min(text.length, 9999);
    textArea.setSelectionRange(0, selectionEnd);
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // If first attempt fails, try again (macOS compatibility)
      if (!successful) {
        // Small delay and retry
        setTimeout(() => {
          try {
            document.execCommand('copy');
          } catch (retryError) {
            console.error('Retry failed to copy text with execCommand: ', retryError);
          }
        }, 10);
      }
      
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
    // First try the modern clipboard API with error handling
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (clipboardError) {
        console.error('navigator.clipboard.writeText failed, falling back to execCommand: ', clipboardError);
        // Continue to fallback instead of throwing immediately
      }
    }
    
    // Fallback to legacy methods with improved macOS compatibility
    return await new Promise<void>((resolve, reject) => {
      try {
        // Create a temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Position element off-screen with improved macOS styling
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.style.zIndex = '-1000';
        textArea.style.whiteSpace = 'pre'; // Preserve formatting
        
        // Add to DOM
        document.body.appendChild(textArea);
        
        // Force a reflow to ensure proper rendering
        void textArea.offsetWidth;
        
        // Set selection range for better macOS compatibility
        // For very long text, use a smaller selection range
        const selectionEnd = Math.min(text.length, 9999);
        textArea.setSelectionRange(0, selectionEnd);
        
        // Focus and select
        textArea.focus();
        textArea.select();
        
        // Try to copy with a small delay for better macOS compatibility
        setTimeout(() => {
          try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
              resolve();
            } else {
              // Try again with a different approach for macOS
              setTimeout(() => {
                const successRetry = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successRetry) {
                  resolve();
                } else {
                  reject(new Error('execCommand returned false even after retry'));
                }
              }, 100);
            }
          } catch (execError) {
            document.body.removeChild(textArea);
            reject(new Error(`execCommand failed: ${execError}`));
          }
        }, 10); // Increased delay for better macOS compatibility
      } catch (error) {
        reject(new Error(`Failed to create textarea: ${error}`));
      }
    });
  } catch (err) {
    console.error('Failed to copy text: ', err);
    throw new Error('All clipboard copy methods failed. Please copy manually.');
  }
};
