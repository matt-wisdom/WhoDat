import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { checkJwt } from './middleware/auth.js';
import gameRoutes from './routes/game.js';

dotenv.config();

const app = express();
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

app.listen(port, () => {
  console.log(`Server starting on port ${port}`);
});
