#!/bin/bash

# This script will implement the central repository clone and Git Worktree creation logic.

# Parameters:
# -p: project_id
# -t: task_id
# -r: repository_url
# -P: task_prompt
# -a: agent
# -C: callback_url

while getopts p:t:r:P:a:C: flag
do
    case "${flag}" in
        p) PROJECT_ID=${OPTARG};;
        t) TASK_ID=${OPTARG};;
        r) REPOSITORY_URL=${OPTARG};;
        P) TASK_PROMPT=${OPTARG};;
        a) AGENT=${OPTARG};;
        C) CALLBACK_URL=${OPTARG};;
    esac
done

ARCHON_ROOT="/projects/Archon"
WORKTREE_BASE="/worktrees"

# Ensure worktree base directory exists
mkdir -p "${WORKTREE_BASE}"

# Central repository path
CENTRAL_REPO="${WORKTREE_BASE}/central_repo"

# Clone the central repository if it doesn't exist
if [ ! -d "${CENTRAL_REPO}/.git" ]; then
  echo "Cloning central repository: ${REPOSITORY_URL}"
  git clone "${REPOSITORY_URL}" "${CENTRAL_REPO}"
  if [ $? -ne 0 ]; then
    echo "Error: Failed to clone central repository."
    exit 1
  fi
else
  echo "Central repository already exists. Pulling latest changes."
  cd "${CENTRAL_REPO}"
  git pull
  if [ $? -ne 0 ]; then
    echo "Error: Failed to pull latest changes in central repository."
    exit 1
  fi
  cd -
fi

# Create a new worktree for the task
WORKTREE_PATH="${WORKTREE_BASE}/${TASK_ID}"
BRANCH_NAME="task-${TASK_ID}"

echo "Creating worktree for task ${TASK_ID} at ${WORKTREE_PATH}"
cd "${CENTRAL_REPO}"
git worktree add -b "${BRANCH_NAME}" "${WORKTREE_PATH}"
if [ $? -ne 0 ]; then
  echo "Error: Failed to create worktree."
  exit 1
fi
cd -

# Copy context files to the worktree
if [ -f "${ARCHON_ROOT}/.env" ]; then
    echo "Copying .env file to worktree."
    cp "${ARCHON_ROOT}/.env" "${WORKTREE_PATH}/.env"
fi

echo "Worktree created successfully."
echo "Project ID: ${PROJECT_ID}"
echo "Task ID: ${TASK_ID}"
echo "Repository URL: ${REPOSITORY_URL}"
echo "Task Prompt: ${TASK_PROMPT}"

# Execute the selected agent
cd "${WORKTREE_PATH}"
case "${AGENT}" in
    claude)
        echo "Executing Claude CLI..."
        claude-cli "${TASK_PROMPT}"
        AGENT_EXIT_CODE=$?
        ;;
    gemini)
        echo "Executing Gemini CLI..."
        gemini-cli "${TASK_PROMPT}"
        AGENT_EXIT_CODE=$?
        ;;
    qwen)
        echo "Executing Qwen CLI..."
        qwen-cli "${TASK_PROMPT}"
        AGENT_EXIT_CODE=$?
        ;;
    *)
        echo "Error: Unknown agent '${AGENT}'"
        exit 1
        ;;
esac
cd -

# Notify ArchonOS of the result
if [ ${AGENT_EXIT_CODE} -eq 0 ]; then
    STATUS="COMPLETED"
else
    STATUS="ERROR"
fi

echo "Agent finished work for task ${TASK_ID} with status ${STATUS}. Notifying ArchonOS."

curl -X POST -H "Content-Type: application/json" -d "{\"status\": \"${STATUS}\"}" "${CALLBACK_URL}"

exit 0
