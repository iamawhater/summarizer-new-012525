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

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || https://vercel.com/iamawhaters-projects/summarizer-new-012525-wxa5/3oaGnLAN3Bfe29NhjBJi5vVdRzWV,
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};


const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors(corsOptions));
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
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });
    
    const transcribedText = transcription.text;

    // Generate summary using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an assistant that summarizes long texts." },
        { role: "user", content: `Summarize the following content: ${transcribedText}. Give 10 very important bullet points` }
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