import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { ENV } from './config/env';
import { socketService } from './services/socket.service';
import { authRouter } from './routes/auth.routes';
import { tenantRouter } from './routes/tenant.routes';
import { chatRouter } from './routes/chat.routes';
import { kanbanRouter } from './routes/kanban.routes';
import { broadcastRouter } from './routes/broadcast.routes';
import { templatesRouter } from './routes/templates.routes';
import { mediaRouter } from './routes/media.routes';
import { webhookRouter } from './routes/webhook.routes';
import { groupsRouter } from './routes/groups.routes';
import { teamRouter } from './routes/team.routes';

const app = express();
const server = http.createServer(app);

app.use(cors());
// Increased body limit to 50mb to support HD image, video, and PDF uploads in templates & media catalog
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

socketService.init(server);

app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'DanMax WA SaaS Multi-Tenant Backend (OpenWA Engine)',
    environment: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/chats', chatRouter);
app.use('/api/kanban', kanbanRouter);
app.use('/api/broadcasts', broadcastRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/team', teamRouter);

// Serve Frontend Static Bundle in Production
const frontendDistPath = path.join(__dirname, '../frontend-dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    const indexPath = path.join(frontendDistPath, 'index.html');
    return res.sendFile(indexPath, (err) => {
      if (err) {
        res.send('DanMax WA Backend Online. Frontend bundle loading...');
      }
    });
  }
});

server.listen(ENV.PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 DanMax WA SaaS Backend server running on port ${ENV.PORT}`);
  console.log(`📱 OpenWA Engine target: ${ENV.OPENWA_API_URL}`);
  console.log(`=================================================`);
});
