import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Loader2, AlertCircle, Archive, Trash2 } from 'lucide-react';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import { DeleteConfirmModal } from './ProjectPage';

export function ArchivePage() {
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null);

  const loadArchivedProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const projects = await projectService.listArchivedProjects();
      setArchivedProjects(projects);
    } catch (err) {
      setError('Failed to load archived projects.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchivedProjects();
  }, [loadArchivedProjects]);

  const handleUnarchive = async (project: Project) => {
    try {
      await projectService.archiveProject(project.id, false);
      showToast(`Project "${project.title}" unarchived successfully.`, 'success');
      loadArchivedProjects(); // Refresh the list
    } catch (error) {
      showToast('Failed to unarchive project. Please try again.', 'error');
      console.error('Failed to unarchive project:', error);
    }
  };

  const handleDelete = (e: React.MouseEvent, projectId: string, projectTitle: string) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, title: projectTitle });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;

    try {
      await projectService.deleteProject(projectToDelete.id);
      showToast(`Project "${projectToDelete.title}" deleted successfully`, 'success');
      loadArchivedProjects(); // Refresh the list
    } catch (error) {
      showToast('Failed to delete project. Please try again.', 'error');
      console.error('Failed to delete project:', error);
    } finally {
      setShowDeleteConfirm(false);
      setProjectToDelete(null);
    }
  }, [projectToDelete, showToast, loadArchivedProjects]);

  const cancelDeleteProject = useCallback(() => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto p-4"
    >
      <h1 className="text-2xl font-bold mb-4">Archived Projects</h1>
      {isLoading && (
        <div className="flex justify-center items-center">
          <Loader2 className="animate-spin h-8 w-8 text-purple-500" />
        </div>
      )}
      {error && (
        <div className="text-red-500 flex items-center">
          <AlertCircle className="mr-2" /> {error}
        </div>
      )}
      {!isLoading && !error && (
        <div className="space-y-4">
          {archivedProjects.length === 0 ? (
            <p>No archived projects found.</p>
          ) : (
            archivedProjects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="group relative p-4 rounded-lg bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 transition-shadow shadow-glow-bottom-purple"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-grow">
                    <h2 className="font-bold text-gray-800 dark:text-gray-200">{project.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{project.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Archived on: {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      onClick={() => handleUnarchive(project)}
                      variant="outline"
                      className="group-hover:bg-green-50 dark:group-hover:bg-green-900/20 group-hover:border-green-400 dark:group-hover:border-green-600 transition-colors"
                    >
                      <Archive className="mr-2 h-4 w-4 text-green-500" />
                      <span className="text-green-700 dark:text-green-300">Unarchive</span>
                    </Button>
                    <Button
                      onClick={(e) => handleDelete(e, project.id, project.title)}
                      variant="destructive"
                      className="group-hover:bg-red-500 dark:group-hover:bg-red-600 group-hover:text-white"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
       {showDeleteConfirm && projectToDelete && (
        <DeleteConfirmModal
          itemName={projectToDelete.title}
          onConfirm={confirmDeleteProject}
          onCancel={cancelDeleteProject}
          type="project"
        />
      )}
    </motion.div>
  );
}