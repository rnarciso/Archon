# Archon Project Overview

This document provides a comprehensive overview of the Archon project, its architecture, and development conventions to be used as a context for AI assistants.

## Project Overview

Archon is a Model Context Protocol (MCP) server that acts as a command center for AI coding assistants. It provides a web-based UI to manage knowledge, context, and tasks for your projects. For AI coding assistants, it provides an MCP server to collaborate on and leverage the same knowledge, context, and tasks.

The project is built with a microservices architecture and includes the following main components:

*   **Frontend:** A React application built with Vite, using TypeScript, Radix UI for components, and TanStack Query for data fetching. The UI is served on port 3737 by default.
*   **Backend Server:** A FastAPI application that provides the core business logic and APIs for the web UI. It's responsible for web crawling, document processing, and other tasks. The server runs on port 8181 by default.
*   **MCP Server:** A lightweight server that provides the Model Context Protocol interface for AI clients. It runs on port 8051 by default.
*   **Agents Service:** A service for AI/ML operations, such as reranking. It runs on port 8052 by default.
*   **Database:** Archon uses Supabase (PostgreSQL with pgvector) for its database.

The entire application is containerized using Docker.

## Building and Running

The project uses a `Makefile` to simplify common development tasks.

### Prerequisites

*   Docker Desktop
*   Node.js 18+
*   Supabase account
*   OpenAI API key

### Setup

1.  **Clone the repository:**
    ```bash
    git clone -b stable https://github.com/coleam00/archon.git
    cd archon
    ```

2.  **Configure environment:**
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file and add your Supabase credentials.

3.  **Set up the database:**
    Execute the SQL script in `migration/complete_setup.sql` in your Supabase project's SQL Editor.

4.  **Install dependencies:**
    ```bash
    make install
    ```

### Running the Application

There are two ways to run the application for development:

*   **Hybrid Mode (Recommended):** This mode runs the backend services in Docker and the frontend locally with hot-reloading.
    ```bash
    make dev
    ```

*   **Full Docker Mode:** This mode runs all services in Docker.
    ```bash
    make dev-docker
    ```

### Stopping the Application

```bash
make stop
```

### Testing

*   **Run all tests:**
    ```bash
    make test
    ```

*   **Run frontend tests:**
    ```bash
    make test-fe
    ```

*   **Run backend tests:**
    ```bash
    make test-be
    ```

### Linting

*   **Lint all code:**
    ```bash
    make lint
    ```

*   **Lint frontend code:**
    ```bash
    make lint-fe
    ```

*   **Lint backend code:**
    ```bash
    make lint-be
    ```

## Development Conventions

### Python Backend

*   **Dependency Management:** The project uses `uv` to manage Python dependencies. Dependencies for each service are defined in `python/pyproject.toml`.
*   **Code Style:** The project uses `ruff` for linting and formatting. The configuration is in `python/pyproject.toml`.
*   **Type Checking:** `mypy` is used for static type checking. The configuration is in `python/pyproject.toml`.
*   **Testing:** The backend uses `pytest` for testing.

### Frontend

*   **Framework:** The frontend is a React application built with Vite.
*   **Language:** The project uses TypeScript.
*   **Component Library:** Radix UI is used for UI components.
*   **Data Fetching:** TanStack Query is used for data fetching and state management.
*   **Testing:** The frontend uses `vitest` for unit and integration testing.
*   **Linting:** The project uses ESLint and Biome for linting and formatting. The configuration is in `archon-ui-main/package.json`, `archon-ui-main/.eslintrc.cjs`, and `archon-ui-main/biome.json`.
