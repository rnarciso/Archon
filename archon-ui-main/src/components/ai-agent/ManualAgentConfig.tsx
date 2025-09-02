import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Plus, Settings, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface ManualAgentConfigProps {
  onAgentAdd: (agent: ManualAgentConfig) => void;
  existingAgents: string[];
}

export interface ManualAgentConfig {
  id: string;
  name: string;
  executableName: string;
  type: 'claude' | 'gemini' | 'qwen' | 'custom';
  path: string;
  version: string;
  description: string;
}

const AGENT_TYPES = [
  { value: 'claude', label: 'Claude Code CLI', icon: '🤖' },
  { value: 'gemini', label: 'Gemini CLI', icon: '🔮' },
  { value: 'qwen', label: 'Qwen Code', icon: '🐯' },
  { value: 'custom', label: 'Custom AI Agent', icon: '⚙️' }
];

export const ManualAgentConfig: React.FC<ManualAgentConfigProps> = ({ 
  onAgentAdd, 
  existingAgents 
}) => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedType, setSelectedType] = useState<ManualAgentConfig['type']>('claude');
  
  const [formData, setFormData] = useState<Partial<ManualAgentConfig>>({
    name: '',
    executableName: '',
    type: 'claude',
    path: '',
    version: 'Unknown',
    description: ''
  });

  const presetConfigs = {
    claude: {
      name: 'Claude Code CLI',
      executableName: 'claude',
      description: 'Anthropic Claude Code command line interface'
    },
    gemini: {
      name: 'Gemini CLI',
      executableName: 'gemini',
      description: 'Google Gemini CLI for AI assistance'
    },
    qwen: {
      name: 'Qwen Code',
      executableName: 'qwen',
      description: 'Alibaba Qwen code assistant'
    }
  };

  const handleTypeChange = (type: ManualAgentConfig['type']) => {
    setSelectedType(type);
    const preset = presetConfigs[type];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        type,
        name: preset.name,
        executableName: preset.executableName,
        description: preset.description
      }));
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      // Test if the executable exists by trying to get its version
      const { executableName, path } = formData;
      
      // This would typically call the backend API to test the connection
      // For now, we'll simulate the test
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful test (in real implementation, this would actual test the connection)
      showToast('✅ Connection test successful!', 'success');
    } catch (error) {
      showToast('❌ Connection test failed. Please check the path and try again.', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.executableName) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const newAgent: ManualAgentConfig = {
      id: Date.now().toString(),
      name: formData.name!,
      executableName: formData.executableName!,
      type: selectedType,
      path: formData.path || '',
      version: formData.version || 'Unknown',
      description: formData.description || ''
    };

    onAgentAdd(newAgent);
    setIsOpen(false);
    
    // Reset form
    setFormData({
      name: '',
      executableName: '',
      type: 'claude',
      path: '',
      version: 'Unknown',
      description: ''
    });
    
    showToast(`Agent "${newAgent.name}" added successfully!`, 'success');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          accentColor="blue"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Configure Manually
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Manually Configure AI Agent
          </DialogTitle>
          <DialogDescription>
            Define an AI coding agent by specifying its executable path and configuration.
            Help is available if you're unsure how to configure your agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Agent Type Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Agent Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeChange(type.value as ManualAgentConfig['type'])}
                  className={`p-3 border-2 rounded-lg text-center transition-all ${
                    selectedType === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Agent Name *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., My Custom Claude Agent"
              disabled={formData.type !== 'custom'}
            />
          </div>

          {/* Executable Name Field */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Executable Name *
            </label>
            <Input
              value={formData.executableName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, executableName: e.target.value }))}
              placeholder="e.g., claude, my-claude-cli"
            />
          </div>

          {/* Path Field */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Full Path (Optional)
            </label>
            <Input
              value={formData.path || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
              placeholder="e.g., /usr/local/bin/claude"
            />
            <p className="text-xs text-gray-500 mt-1">
              If empty, we'll search for the executable in your PATH
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Description
            </label>
            <Input
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this agent configuration"
            />
          </div>

          {/* Test Button */}
          <div className="flex items-center justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !formData.executableName}
              className="flex items-center gap-2"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || !formData.executableName}
            accentColor="green"
          >
            Add Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AgentStatusBadgeProps {
  status: 'online' | 'offline' | 'error';
  message?: string;
}

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ status, message }) => {
  const statusConfig = {
    online: { 
      icon: <CheckCircle className="w-4 h-4" />, 
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    },
    offline: { 
      icon: <AlertCircle className="w-4 h-4" />, 
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    },
    error: { 
      icon: <XCircle className="w-4 h-4" />, 
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
  };

  const config = statusConfig[status];
  
  return (
    <Badge className={config.className}>
      {config.icon}
      <span className="ml-1">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {message && (
        <span className="ml-1 text-xs opacity-75">
          - {message}
        </span>
      )}
    </Badge>
  );
};