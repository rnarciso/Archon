import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

import { Select } from '../ui/Select';
import { projectService } from '../../services/projectService';

interface AgentConfigTabProps {
  project: {
    id: string;
    agent_config?: {
      agent: string;
    }
  };
}

export const AgentConfigTab: React.FC<AgentConfigTabProps> = ({ project }) => {
  const [selectedAgent, setSelectedAgent] = useState(project.agent_config?.agent || '');

  const agentOptions = [
    { value: 'claude', label: 'Claude' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'qwen', label: 'Qwen' },
  ];

  const handleAgentChange = async (value: string) => {
    setSelectedAgent(value);
    try {
      await projectService.updateAgentConfig(project.id, value);
      // Maybe show a toast notification on success
    } catch (error) {
      console.error('Failed to update agent config', error);
      // Maybe show a toast notification on error
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          label="CLI Agent"
          options={agentOptions}
          value={selectedAgent}
          onChange={(e) => handleAgentChange(e.target.value)}
          accentColor="green"
        />
      </CardContent>
    </Card>
  );
};
