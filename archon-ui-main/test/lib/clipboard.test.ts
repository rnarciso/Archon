/**
 * Unit tests for clipboard utility functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyToClipboard } from '../../src/lib/clipboard';

describe('clipboard utilities', () => {
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
      const mockExecCommand = vi.fn().mockImplementation(() => {
        const mockTextArea: any = document.createElement('textarea');
        mockTextArea.value = 'test text';
        mockTextArea.style.position = 'fixed';
        mockTextArea.style.left = '-9999px';
        mockTextArea.style.top = '-9999px';
        mockTextArea.style.opacity = '0';
        document.body.appendChild(mockTextArea);
        mockTextArea.focus();
        mockTextArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(mockTextArea);
        return successful;
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
});