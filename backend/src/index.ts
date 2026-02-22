import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { checkJwt, authMiddleware } from './middleware/auth.js';
import gameRoutes from './routes/game.js';
import { setupSocket } from './socket.js';
import { initCache } from './services/wikiCache.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Setup Clerk middleware
app.use(authMiddleware);

setupSocket(io);

const port = process.env.PORT || 8080;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/game', checkJwt, gameRoutes);

httpServer.listen(port, () => {
  console.log(`Server starting on port ${port}`);
  // Populate / refresh the wiki article cache in the background
  initCache();
});

