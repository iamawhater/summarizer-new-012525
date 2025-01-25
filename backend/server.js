// server.js
import express from 'express';
import cors from 'cors';
import ytdl from 'ytdl-core';
import pkg from 'whisper-node';
const { Whisper } = pkg;
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: './temp/',
  filename: (req, file, cb) => {
    cb(null, 'audio-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Whisper
const whisper = new Whisper({
  modelName: 'base',
  whisperPath: process.env.WHISPER_PATH || 'whisper'
});

// Utility function to clean up temporary files
const cleanup = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error('Error deleting temporary file:', err);
  });
};

// Main API endpoint for video summarization
app.post('/api/summarize', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let audioPath = null;

  try {
    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      throw new Error('Invalid YouTube URL');
    }

    // Download audio
    const videoInfo = await ytdl.getInfo(url);
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, { quality: 'highestaudio' });
    
    audioPath = path.join('./temp', `audio-${Date.now()}.mp3`);
    
    await new Promise((resolve, reject) => {
      ytdl(url, { format: audioFormat })
        .pipe(fs.createWriteStream(audioPath))
        .on('finish', resolve)
        .on('error', reject);
    });

    // Transcribe audio
    const transcription = await whisper.transcribe(audioPath);

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an assistant that summarizes long texts." },
        { role: "user", content: `Summarize the following content: ${transcription}. Give 10 very important bullet points` }
      ],
    });

    const summary = completion.choices[0].message.content;

    // Clean up temporary file
    cleanup(audioPath);

    res.json({ summary });

  } catch (error) {
    if (audioPath) cleanup(audioPath);
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});