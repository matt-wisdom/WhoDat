import { clerkMiddleware, requireAuth } from '@clerk/express';
import dotenv from 'dotenv';

dotenv.config();

// Export middleware directly or wrap if needed
export const authMiddleware = clerkMiddleware();
export const checkJwt = requireAuth();
