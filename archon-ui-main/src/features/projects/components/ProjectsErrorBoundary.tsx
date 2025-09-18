import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";
import { Button } from "../../ui/primitives";

interface ProjectsErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ProjectsErrorFallback({ error, resetError }: ProjectsErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Projects Feature Error</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error.message || "An unexpected error occurred while loading projects."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={resetError} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ProjectsErrorBoundaryProps {
  children: React.ReactNode;
}

interface ProjectsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ProjectsErrorBoundary extends React.Component<ProjectsErrorBoundaryProps, ProjectsErrorBoundaryState> {
  constructor(props: ProjectsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ProjectsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Projects Error Boundary caught an error:", error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return <ProjectsErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}
