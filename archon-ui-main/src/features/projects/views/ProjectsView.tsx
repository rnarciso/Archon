import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStaggeredEntrance } from "../../../hooks/useStaggeredEntrance";
import { DeleteConfirmModal } from "../../ui/components/DeleteConfirmModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/primitives";
import { NewProjectModal } from "../components/NewProjectModal";
import { ProjectHeader } from "../components/ProjectHeader";
import { ProjectList } from "../components/ProjectList";
import { DocsTab } from "../documents/DocsTab";
import {
  projectKeys,
  useArchiveProject,
  useDeleteProject,
  useProjects,
  useTaskCounts,
  useUnarchiveProject,
  useUpdateProject,
} from "../hooks/useProjectQueries";
import { TasksTab } from "../tasks/TasksTab";
import type { Project } from "../types";

interface ProjectsViewProps {
  className?: string;
  "data-id"?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.23, 1, 0.32, 1] },
  },
};

export function ProjectsView({ className = "", "data-id": dataId }: ProjectsViewProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Loading states for operations
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const [unarchivingProjectId, setUnarchivingProjectId] = useState<string | null>(null);

  // Navigation state tracking to prevent infinite loops
  const lastNavigationRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // React Query hooks
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError } = useProjects();
  const { data: taskCounts = {}, refetch: refetchTaskCounts } = useTaskCounts();

  // Mutations
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const archiveProjectMutation = useArchiveProject();
  const unarchiveProjectMutation = useUnarchiveProject();

  // Loading state management
  useEffect(() => {
    setDeletingProjectId(deleteProjectMutation.isPending ? deleteProjectMutation.variables : null);
  }, [deleteProjectMutation.isPending, deleteProjectMutation.variables]);

  useEffect(() => {
    setArchivingProjectId(archiveProjectMutation.isPending ? archiveProjectMutation.variables : null);
  }, [archiveProjectMutation.isPending, archiveProjectMutation.variables]);

  useEffect(() => {
    setUnarchivingProjectId(unarchiveProjectMutation.isPending ? unarchiveProjectMutation.variables : null);
  }, [unarchiveProjectMutation.isPending, unarchiveProjectMutation.variables]);

  // Filter and sort projects - pinned first, then alphabetically
  const activeProjects = useMemo(() => {
    return [...(projects as Project[])]
      .filter((p) => !p.archived)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [projects]);

  const archivedProjects = useMemo(() => {
    return [...(projects as Project[])]
      .filter((p) => p.archived)
      .sort((a, b) => {
        return a.title.localeCompare(b.title);
      });
  }, [projects]);

  // Handle project selection
  const handleProjectSelect = useCallback(
    (project: Project) => {
      if (selectedProject?.id === project.id) return;

      setSelectedProject(project);
      setActiveTab("tasks");

      // Only navigate if the URL doesn't already match the selected project
      if (projectId !== project.id) {
        const targetUrl = `/projects/${project.id}`;

        // Prevent rapid successive navigation calls
        if (lastNavigationRef.current !== targetUrl) {
          lastNavigationRef.current = targetUrl;
          navigate(targetUrl, { replace: true });

          // Clear any existing timeout
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }

          // Reset navigation tracking after a delay
          navigationTimeoutRef.current = setTimeout(() => {
            lastNavigationRef.current = null;
          }, 1000);
        }
      }
    },
    [selectedProject?.id, navigate, projectId],
  );

  // Auto-select project based on URL or default to first active project
  useEffect(() => {
    // Prevent infinite navigation loops
    if (selectedProject && selectedProject.id === projectId) {
      return;
    }

    // If there's a projectId in the URL, select that project
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project && project.id !== selectedProject?.id) {
        setSelectedProject(project);
        return;
      }
    }

    // Only auto-select if no project is currently selected or if current selection doesn't exist
    if (!selectedProject || !projects.find((p) => p.id === selectedProject.id)) {
      // Always prefer active projects over archived ones
      const defaultProject = activeProjects.length > 0 ? activeProjects[0] : null;
      if (defaultProject && defaultProject.id !== projectId) {
        const targetUrl = `/projects/${defaultProject.id}`;

        // Prevent rapid successive navigation calls
        if (lastNavigationRef.current !== targetUrl) {
          lastNavigationRef.current = targetUrl;
          setSelectedProject(defaultProject);
          navigate(targetUrl, { replace: true });

          // Clear any existing timeout
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }

          // Reset navigation tracking after a delay
          navigationTimeoutRef.current = setTimeout(() => {
            lastNavigationRef.current = null;
          }, 1000);
        }
      } else if (archivedProjects.length > 0 && !projectId) {
        // Only select archived project if there are no active projects and no URL project
        const archivedProject = archivedProjects[0];
        const targetUrl = `/projects/${archivedProject.id}`;

        if (lastNavigationRef.current !== targetUrl) {
          lastNavigationRef.current = targetUrl;
          setSelectedProject(archivedProject);
          navigate(targetUrl, { replace: true });

          // Clear any existing timeout
          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
          }

          // Reset navigation tracking after a delay
          navigationTimeoutRef.current = setTimeout(() => {
            lastNavigationRef.current = null;
          }, 1000);
        }
      } else if (!selectedProject && projectId) {
        // If URL has a project but it doesn't exist, clear the URL
        setSelectedProject(null);
        navigate("/projects", { replace: true });
      }
    }
  }, [activeProjects, archivedProjects, projectId, selectedProject, navigate, projects]);

  // Refetch task counts when projects change
  useEffect(() => {
    if ((projects as Project[]).length > 0) {
      refetchTaskCounts();
    }
  }, [projects, refetchTaskCounts]);

  // Cleanup navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // Handle pin toggle
  const handlePinProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const project = (projects as Project[]).find((p) => p.id === projectId);
    if (!project) return;

    updateProjectMutation.mutate({
      projectId,
      updates: { pinned: !project.pinned },
    });
  };

  // Handle archive project
  const handleArchiveProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    // Prevent archiving if already an operation in progress on this project
    if (archivingProjectId || unarchivingProjectId || deletingProjectId) {
      return;
    }
    archiveProjectMutation.mutate(projectId);
  };

  // Handle unarchive project
  const handleUnarchiveProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    // Prevent unarchiving if already an operation in progress on this project
    if (archivingProjectId || unarchivingProjectId || deletingProjectId) {
      return;
    }
    unarchiveProjectMutation.mutate(projectId);
  };

  // Handle selection logic when projects are archived/unarchived
  useEffect(() => {
    if (selectedProject && selectedProject.archived && activeProjects.length > 0) {
      // If selected project is archived but there are active projects, switch to an active one
      const nextActiveProject = activeProjects[0];
      setSelectedProject(nextActiveProject);
      navigate(`/projects/${nextActiveProject.id}`, { replace: true });
    }
  }, [activeProjects, selectedProject, navigate]);

  // Handle delete project
  const handleDeleteProject = (e: React.MouseEvent, projectId: string, title: string) => {
    e.stopPropagation();
    // Prevent deletion if already an operation in progress on this project
    if (archivingProjectId || unarchivingProjectId || deletingProjectId) {
      return;
    }
    setProjectToDelete({ id: projectId, title });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProject = () => {
    if (!projectToDelete) return;

    deleteProjectMutation.mutate(projectToDelete.id, {
      onSuccess: () => {
        // Success toast handled by mutation
        setShowDeleteConfirm(false);
        setProjectToDelete(null);

        // If we deleted the selected project, select another one
        if (selectedProject?.id === projectToDelete.id) {
          const remainingActiveProjects = activeProjects.filter((p) => p.id !== projectToDelete.id);
          const remainingArchivedProjects = archivedProjects.filter((p) => p.id !== projectToDelete.id);

          // Priority: active projects first, then archived projects
          if (remainingActiveProjects.length > 0) {
            const nextProject = remainingActiveProjects[0];
            setSelectedProject(nextProject);
            navigate(`/projects/${nextProject.id}`, { replace: true });
          } else if (remainingArchivedProjects.length > 0) {
            const nextProject = remainingArchivedProjects[0];
            setSelectedProject(nextProject);
            navigate(`/projects/${nextProject.id}`, { replace: true });
          } else {
            setSelectedProject(null);
            navigate("/projects", { replace: true });
          }
        }
      },
    });
  };

  const cancelDeleteProject = () => {
    setShowDeleteConfirm(false);
    setProjectToDelete(null);
  };

  // Staggered entrance animation
  const isVisible = useStaggeredEntrance([1, 2, 3], 0.15);

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className={`max-w-full mx-auto ${className}`}
      data-id={dataId}
    >
      <ProjectHeader onNewProject={() => setIsNewProjectModalOpen(true)} />

      {/* Active Projects Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-blue-400">Active Projects</h2>
          <span className="text-sm text-gray-400">{activeProjects.length} projects</span>
        </div>
        <ProjectList
          projects={activeProjects}
          selectedProject={selectedProject}
          taskCounts={taskCounts}
          isLoading={isLoadingProjects}
          error={projectsError as Error | null}
          onProjectSelect={handleProjectSelect}
          onPinProject={handlePinProject}
          onDeleteProject={handleDeleteProject}
          onArchiveProject={handleArchiveProject}
          onUnarchiveProject={handleUnarchiveProject}
          onRetry={() => queryClient.invalidateQueries({ queryKey: projectKeys.lists() })}
          showArchived={false}
          deletingProjectId={deletingProjectId}
          archivingProjectId={archivingProjectId}
          unarchivingProjectId={unarchivingProjectId}
        />
      </div>

      {/* Archived Projects Section */}
      {archivedProjects.length > 0 && (
        <div className="border-t border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-400">Archived Projects</h2>
            <span className="text-sm text-gray-500">{archivedProjects.length} archived</span>
          </div>
          <ProjectList
            projects={archivedProjects}
            selectedProject={selectedProject}
            taskCounts={taskCounts}
            isLoading={isLoadingProjects}
            error={projectsError as Error | null}
            onProjectSelect={handleProjectSelect}
            onPinProject={handlePinProject}
            onDeleteProject={handleDeleteProject}
            onArchiveProject={handleArchiveProject}
            onUnarchiveProject={handleUnarchiveProject}
            onRetry={() => queryClient.invalidateQueries({ queryKey: projectKeys.lists() })}
            showArchived={true}
            deletingProjectId={deletingProjectId}
            archivingProjectId={archivingProjectId}
            unarchivingProjectId={unarchivingProjectId}
          />
        </div>
      )}

      {/* Project Details Section */}
      {selectedProject && (
        <motion.div variants={itemVariants} className="relative">
          <Tabs defaultValue="tasks" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="docs" className="py-3 font-mono transition-all duration-300" color="blue">
                Docs
              </TabsTrigger>
              <TabsTrigger value="tasks" className="py-3 font-mono transition-all duration-300" color="orange">
                Tasks
              </TabsTrigger>
            </TabsList>

            {/* Tab content */}
            <div>
              {activeTab === "docs" && (
                <TabsContent value="docs" className="mt-0">
                  <DocsTab project={selectedProject} />
                </TabsContent>
              )}
              {activeTab === "tasks" && (
                <TabsContent value="tasks" className="mt-0">
                  <TasksTab projectId={selectedProject.id} />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </motion.div>
      )}

      {/* Modals */}
      <NewProjectModal
        open={isNewProjectModalOpen}
        onOpenChange={setIsNewProjectModalOpen}
        onSuccess={() => refetchTaskCounts()}
      />

      {showDeleteConfirm && projectToDelete && (
        <DeleteConfirmModal
          itemName={projectToDelete.title}
          onConfirm={confirmDeleteProject}
          onCancel={cancelDeleteProject}
          type="project"
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
        />
      )}
    </motion.div>
  );
}
