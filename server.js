require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); 

// --- DATABASE SCHEMA ---
const scoreSchema = new mongoose.Schema({
    name: String,
    score: Number,
    difficulty: String
});
const Score = mongoose.model('Score', scoreSchema);

// --- API ROUTES ---
app.get('/api/scores/:difficulty', async (req, res) => {
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
    try {
        const newScore = new Score({
            name: req.body.name,
            score: req.body.score,
            difficulty: req.body.difficulty
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

startServer().catch(error => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
});