/// <reference types="vitest" />
import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, exec } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import type { ConfigEnv, UserConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Get host and port from environment variables or use defaults
  // For internal Docker communication, use the service name
  // For external access, use the HOST from environment
  const isDocker = process.env.DOCKER_ENV === 'true' || !!process.env.HOSTNAME;
  const internalHost = 'archon-server';  // Docker service name for internal communication
  const externalHost = process.env.HOST || 'localhost';  // Host for external access
  const host = isDocker ? internalHost : externalHost;
  const port = process.env.ARCHON_SERVER_PORT || env.ARCHON_SERVER_PORT || '8181';
  
  return {
    plugins: [
      react(),
      // Custom plugin to add test endpoint
      {
        name: 'test-runner',
        configureServer(server) {
          // Serve coverage directory statically
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/coverage/')) {
              const filePath = path.join(process.cwd(), req.url);
              console.log('[VITE] Serving coverage file:', filePath);
              try {
                const data = await readFile(filePath);
                const contentType = req.url.endsWith('.json') ? 'application/json' : 
                                  req.url.endsWith('.html') ? 'text/html' : 'text/plain';
                res.setHeader('Content-Type', contentType);
                res.end(data);
              } catch (err) {
                console.log('[VITE] Coverage file not found:', filePath);
                res.statusCode = 404;
                res.end('Not found');
              }
            } else {
              next();
            }
          });
          
          // Test execution endpoint (basic tests)
          server.middlewares.use('/api/run-tests', (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method not allowed');
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
            });

            // Use spawn for better streaming of stdout/stderr
            const testProcess = spawn('npm', ['run', 'test', '--', '--run'], {
              cwd: process.cwd(),
              shell: true // Use shell to properly handle npm scripts
            });

            testProcess.stdout.on('data', (data) => {
              const text = data.toString();
              const lines = text.split('\n');
              
              lines.forEach((line: string) => {
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
              
              if (res.flushHeaders) {
                res.flushHeaders();
              }
            });

            testProcess.stderr.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
                res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            testProcess.on('close', (code) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'completed', 
                exit_code: code, 
                status: code === 0 ? 'completed' : 'failed',
                message: code === 0 ? 'Tests completed and results generated!' : 'Tests failed',
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            testProcess.on('error', (error) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message, 
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            req.on('close', () => {
              testProcess.kill();
            });
          });

          // Test execution with coverage endpoint (VERSÃO CORRIGIDA)
          server.middlewares.use('/api/run-tests-with-coverage', (req: any, res: any) => {
            if (req.method !== 'POST') {
                res.statusCode = 405;
                res.end('Method not allowed');
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            });

            // Garante que o diretório de resultados de teste exista
            const testResultsDir = path.join(process.cwd(), 'public', 'test-results');
            if (!existsSync(testResultsDir)) {
                mkdirSync(testResultsDir, { recursive: true });
            }

            // Usa 'spawn' para executar o comando e capturar a saída em tempo real
            const testProcess = spawn('npm', ['run', 'test:coverage'], {
                cwd: process.cwd(),
                shell: true, // Garante compatibilidade entre SOs (ex: Windows)
                env: {
                    ...process.env,
                    NODE_ENV: 'test',
                    CI: 'true', // Opcional: Para um output mais limpo no terminal
                }
            });

            // Captura a saída padrão (stdout)
            testProcess.stdout.on('data', (data) => {
                const text = data.toString();
                const lines = text.split('\n');
                
                lines.forEach((line: string) => {
                    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, ''); // Remove códigos de cor
                    res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
                });

                if (res.flushHeaders) {
                    res.flushHeaders();
                }
            });

            // Captura a saída de erro (stderr)
            testProcess.stderr.on('data', (data) => {
                const text = data.toString();
                const lines = text.split('\n');
                lines.forEach((line: string) => {
                    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
                    res.write(`data: ${JSON.stringify({ type: 'output', message: cleanLine, timestamp: new Date().toISOString() })}\n\n`);
                });
            });

            // Quando o processo terminar
            testProcess.on('close', (code) => {
                res.write(`data: ${JSON.stringify({ 
                    type: 'completed', 
                    exit_code: code, 
                    status: code === 0 ? 'completed' : 'failed',
                    message: code === 0 ? 'Tests completed with coverage!' : 'Tests failed',
                    timestamp: new Date().toISOString() 
                })}\n\n`);
                res.end();
            });

            // Em caso de erro ao iniciar o processo
            testProcess.on('error', (error) => {
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    message: error.message, 
                    timestamp: new Date().toISOString() 
                })}\n\n`);
                res.end();
            });

            // Se o cliente fechar a conexão
            req.on('close', () => {
                testProcess.kill();
            });
          });

          // Endpoint to retrieve the test output file
          server.middlewares.use('/api/get-test-output', async (req, res) => {
            try {
              const logPath = path.join(process.cwd(), 'test_output.log');
              if (existsSync(logPath)) {
                const content = await readFile(logPath, 'utf-8');
                res.setHeader('Content-Type', 'text/plain');
                res.end(content);
              } else {
                res.statusCode = 404;
                res.end('Test output file not found.');
              }
            } catch (error: any) {
              res.statusCode = 500;
              res.end(`Error reading test output file: ${error.message}`);
            }
          });

          // Coverage generation endpoint
          server.middlewares.use('/api/generate-coverage', (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method not allowed');
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
            });

            res.write(`data: ${JSON.stringify({ 
              type: 'status', 
              message: 'Starting coverage generation...', 
              timestamp: new Date().toISOString() 
            })}\n\n`);

            // Run coverage generation
            const coverageProcess = exec('npm run test:coverage', {
              cwd: process.cwd()
            });

            coverageProcess.stdout?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            coverageProcess.stderr?.on('data', (data) => {
              const lines = data.toString().split('\n').filter((line: string) => line.trim());
              lines.forEach((line: string) => {
                res.write(`data: ${JSON.stringify({ type: 'output', message: line, timestamp: new Date().toISOString() })}\n\n`);
              });
            });

            coverageProcess.on('close', (code) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'completed', 
                exit_code: code, 
                status: code === 0 ? 'completed' : 'failed',
                message: code === 0 ? 'Coverage report generated successfully!' : 'Coverage generation failed',
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            coverageProcess.on('error', (error) => {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message, 
                timestamp: new Date().toISOString() 
              })}\n\n`);
              res.end();
            });

            req.on('close', () => {
              coverageProcess.kill();
            });
          });
        }
      }
    ],
    server: {
      host: '0.0.0.0', // Listen on all network interfaces with explicit IP
      port: 5173, // Match the port expected in Docker
      strictPort: true, // Exit if port is in use
      proxy: {
        '/api': {
          target: `http://${host}:${port}`,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('🚨 [VITE PROXY ERROR]:', err.message);
              console.log('🚨 [VITE PROXY ERROR] Target:', `http://${host}:${port}`);
              console.log('🚨 [VITE PROXY ERROR] Request:', req.url);
            });
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log('🔄 [VITE PROXY] Forwarding:', req.method, req.url, 'to', `http://${host}:${port}${req.url}`);
            });
          }
        },
        // Socket.IO specific proxy configuration
        '/socket.io': {
          target: `http://${host}:${port}`,
          changeOrigin: true,
          ws: true
        }
      },
    },
    define: {
      'import.meta.env.VITE_HOST': JSON.stringify(host),
      'import.meta.env.VITE_PORT': JSON.stringify(port),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './test/setup.ts',
      css: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
      ],
      env: {
        VITE_HOST: host,
        VITE_PORT: port,
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData.ts',
          '**/*.test.{ts,tsx}',
        ],
      }
    }
  };
});