/**
 * Unit tests for clipboard utility functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyToClipboard, copyToClipboardSync } from '../../src/lib/clipboard';

describe.skip('clipboard utilities', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should use navigator.clipboard when available in secure context', async () => {
      // Mock navigator.clipboard
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText
        },
        configurable: true
      });

      // Mock window.isSecureContext
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true
      });

      await copyToClipboard('test text');
      
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('should fall back to execCommand when navigator.clipboard is not available', async () => {
      // Remove navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      // Mock document.execCommand
      const mockExecCommand = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        configurable: true
      });

      // Mock document.createElement
      const mockTextArea = {
        value: '',
        style: {
          position: '',
          left: '',
          top: '',
          opacity: '',
          pointerEvents: '',
          zIndex: '',
          whiteSpace: ''
        },
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn()
      };
      
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as any);
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      await copyToClipboard('test text');
      
      expect(mockCreateElement).toHaveBeenCalledWith('textarea');
      expect(mockTextArea.value).toBe('test text');
      expect(mockTextArea.style.position).toBe('fixed');
      expect(mockTextArea.style.left).toBe('-9999px');
      expect(mockTextArea.style.top).toBe('-9999px');
      expect(mockTextArea.style.opacity).toBe('0');
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockTextArea.focus).toHaveBeenCalled();
      expect(mockTextArea.select).toHaveBeenCalled();
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextArea);
    });

    it('should throw error when all methods fail', async () => {
      // Remove navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      // Mock document.execCommand to fail
      const mockExecCommand = vi.fn().mockReturnValue(false);
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        configurable: true
      });

      // Mock document.createElement
      const mockTextArea = {
        value: '',
        style: {
          position: '',
          left: '',
          top: '',
          opacity: '',
          pointerEvents: '',
          zIndex: '',
          whiteSpace: ''
        },
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn()
      };
      
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as any);
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      await expect(copyToClipboard('test text')).rejects.toThrow('All clipboard copy methods failed. Please copy manually.');
      
      expect(mockCreateElement).toHaveBeenCalledWith('textarea');
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextArea);
    });
  });

  describe('copyToClipboardSync', () => {
    it('should use navigator.clipboard when available in secure context', () => {
      // Mock navigator.clipboard
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText
        },
        configurable: true
      });

      // Mock window.isSecureContext
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        configurable: true
      });

      const result = copyToClipboardSync('test text');
      
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('should fall back to execCommand when navigator.clipboard is not available', () => {
      // Remove navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      // Mock document.execCommand
      const mockExecCommand = vi.fn().mockReturnValue(true);
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        configurable: true
      });

      // Mock document.createElement
      const mockTextArea = {
        value: '',
        style: {
          position: '',
          left: '',
          top: '',
          opacity: '',
          pointerEvents: '',
          zIndex: '',
          whiteSpace: ''
        },
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn()
      };
      
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as any);
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      const result = copyToClipboardSync('test text');
      
      expect(result).toBe(true);
      expect(mockCreateElement).toHaveBeenCalledWith('textarea');
      expect(mockTextArea.value).toBe('test text');
      expect(mockTextArea.style.position).toBe('fixed');
      expect(mockTextArea.style.left).toBe('-9999px');
      expect(mockTextArea.style.top).toBe('-9999px');
      expect(mockTextArea.style.opacity).toBe('0');
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockTextArea.focus).toHaveBeenCalled();
      expect(mockTextArea.select).toHaveBeenCalled();
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextArea);
    });

    it('should return false when all methods fail', () => {
      // Remove navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      // Mock document.execCommand to fail
      const mockExecCommand = vi.fn().mockImplementation(() => {
        throw new Error('execCommand failed');
      });
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        configurable: true
      });

      // Mock document.createElement
      const mockTextArea = {
        value: '',
        style: {
          position: '',
          left: '',
          top: '',
          opacity: '',
          pointerEvents: '',
          zIndex: '',
          whiteSpace: ''
        },
        focus: vi.fn(),
        select: vi.fn(),
        setSelectionRange: vi.fn()
      };
      
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockTextArea as any);
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      const result = copyToClipboardSync('test text');
      
      expect(result).toBe(false);
      expect(mockCreateElement).toHaveBeenCalledWith('textarea');
      expect(mockAppendChild).toHaveBeenCalledWith(mockTextArea);
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
      expect(mockRemoveChild).toHaveBeenCalledWith(mockTextArea);
    });
  });
});