require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];
const MAX_SCORE_PER_ROUND = 300;
const allowedOrigins = [
    'https://lokeshmajeti.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(__dirname)); 

app.get('/api/health', (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? 'ok' : 'unavailable',
        database: databaseConnected ? 'connected' : 'disconnected'
    });
});

// --- DATABASE SCHEMA ---
const scoreSchema = new mongoose.Schema({
    name: String,
    score: Number,
    difficulty: String
});
const Score = mongoose.model('Score', scoreSchema);

// --- API ROUTES ---
app.get('/api/scores/:difficulty', async (req, res) => {
    if (!ALLOWED_DIFFICULTIES.includes(req.params.difficulty)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
    }

    try {
        const topScores = await Score.find({ difficulty: req.params.difficulty })
                                     .sort({ score: -1 })
                                     .limit(5);
        res.json(topScores);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch scores" });
    }
});

app.post('/api/scores', async (req, res) => {
    const { name, score, difficulty } = req.body ?? {};
    const playerName = typeof name === 'string' ? name.trim() : '';

    if (!playerName || playerName.length > 12) {
        return res.status(400).json({ error: 'Name must be between 1 and 12 characters' });
    }
    if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE_PER_ROUND) {
        return res.status(400).json({ error: `Score must be an integer between 0 and ${MAX_SCORE_PER_ROUND}` });
    }
    if (!ALLOWED_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
    }

    try {
        const newScore = new Score({
            name: playerName,
            score,
            difficulty
        });
        await newScore.save();
        res.json({ message: "Score saved globally!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save score" });
    }
});

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing. Add your MongoDB connection string to .env.");
    }

    await mongoose.connect(process.env.MONGO_URI, {
        family: 4,
        serverSelectionTimeoutMS: 5000
    });
    console.log("Connected to Global Database!");

    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
    });
}

if (require.main === module) {
    startServer().catch(error => {
        console.error("Server startup failed:", error.message);
        process.exitCode = 1;
    });
}

module.exports = { app, startServer };