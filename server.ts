import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { initSchema } from './src/server/db';
import { registerApiRoutes } from './src/server/routes';
import { seedDatabase } from './src/server/seed';

const app = express();

app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

// Inicializar esquema, datos semilla y rutas API
try {
  initSchema();
  seedDatabase();
} catch (error) {
  console.error('Error inicializando base de datos:', error);
}

registerApiRoutes(app);

// Solo arrancar servidor tradicional si NO estamos en Vercel
if (!process.env.VERCEL) {
  const startLocalServer = async () => {
    const PORT = Number(process.env.PORT || 3000);

    if (process.env.NODE_ENV !== 'production') {
      const { createServer as createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        const indexFile = path.join(distDir, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(404).send('Build not found');
        }
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CRM Político – Gestión Territorial corriendo en http://localhost:${PORT}`);
    });
  };

  startLocalServer();
}

export default app;
