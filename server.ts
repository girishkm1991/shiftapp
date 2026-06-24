import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import { SocketService } from './server/services/SocketService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server for Socket.IO support
  const server = createServer(app);

  // Initialize Socket.IO with the server
  SocketService.init(server);

  // Middleware for parsing requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Simple health check endpoint for container health probes
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // API router goes FIRST
  app.use('/api', apiRouter);

  // Serve static assets in production or use Vite middleware in dev
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running in DEVELOPMENT mode. Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running in PRODUCTION mode. Serving pre-compiled static files...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===================================================`);
    console.log(`   Imvelo Shift Server active on http://0.0.0.0:${PORT}`);
    console.log(`===================================================`);
  });
}


startServer().catch(err => {
  console.error('Failed to start Imvelo Shift Server:', err);
});
