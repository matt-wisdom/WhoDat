import { Router } from 'express';
import { generateResponse } from '../services/gemini.js';

const router = Router();

router.post('/start', (req, res) => {
  // Start game logic (TODO: store game state)
  res.status(200).json({ message: 'Game started' });
});

router.post('/guess', async (req, res) => {
  const { guess } = req.body;

  if (!guess) {
    res.status(400).json({ error: 'Invalid request: "guess" is required' });
    return;
  }

  try {
    const prompt = `User guessed: ${guess}. Reply strictly with 'Yes' or 'No'.`;
    const response = await generateResponse(prompt);
    res.status(200).json({ message: 'Guess received', ai_response: response });
  } catch (error) {
    res.status(500).json({ error: 'AI error: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

export default router;
