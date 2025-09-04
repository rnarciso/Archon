// Enhanced clipboard utility with proper error handling and cross-platform compatibility

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

// Async version - preferred for modern browsers
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    // Try using modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    
    // Fallback to execCommand method
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Hide the textarea from the user
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      throw new Error('All clipboard copy methods failed. Please copy manually.');
    }
  } catch (error) {
    throw new Error(`All clipboard copy methods failed. Please copy manually.`);
  }
};

// Sync version - fallback for older browsers
export const copyToClipboardSync = (text: string): ClipboardResult => {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Hide the textarea from the user
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!successful) {
      return { success: false, error: 'execCommand returned false' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to copy text with execCommand: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

export const isClipboardSupported = (): boolean => {
    return !!(navigator.clipboard || (document.queryCommandSupported && document.queryCommandSupported('copy')));
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
