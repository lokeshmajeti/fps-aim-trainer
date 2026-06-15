// --- AUDIO SYNTHESIZER ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playHitSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}
// --------------------------

const arena = document.getElementById('arena');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const highScoreList = document.getElementById('high-score-list');
const closeModalBtn = document.getElementById('close-modal');
const nameModal = document.getElementById('name-modal');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const finalScoreDisplay = document.getElementById('final-score-display');
const finalDiffDisplay = document.getElementById('final-diff-display');

const diffButtons = document.querySelectorAll('.diff-btn');
const tabButtons = document.querySelectorAll('.tab-btn');

let targetMoveInterval;
let score = 0;
let timeLeft = 30;
let gameInterval;
let pendingScore = 0;
let currentPlayDifficulty = 'medium';
let currentViewDifficulty = 'medium';

// NEW: Your Backend API URL
const API_URL = 'https://aim-trainer-api.onrender.com/api/scores';

// Fetch the global leaderboard immediately when the page loads
updateLeaderboard();

diffButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        diffButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPlayDifficulty = e.target.getAttribute('data-diff');
        document.querySelector(`.tab-btn[data-tab="${currentPlayDifficulty}"]`).click();
    });
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentViewDifficulty = e.target.getAttribute('data-tab');
        updateLeaderboard();
    });
});

function startGame() {
    // --- NEW: Request Fullscreen ---
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.log("Fullscreen blocked by browser:", err.message);
        });
    }
    // -------------------------------

    score = 0;
    timeLeft = 30;
    scoreDisplay.textContent = score;
    timerDisplay.textContent = timeLeft;
    startBtn.disabled = true;
    arena.innerHTML = '';
    
    spawnTarget();
    
    gameInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function spawnTarget() {
    const target = document.createElement('div');
    target.classList.add('target');
    
    let size = 40;
    let moveSpeed = 0;
    
    if (currentPlayDifficulty === 'easy') { size = 50; }
    else if (currentPlayDifficulty === 'medium') { size = 40; moveSpeed = 800; }
    else if (currentPlayDifficulty === 'hard') { size = 25; moveSpeed = 500; }

    target.style.width = size + 'px';
    target.style.height = size + 'px';

    function moveTarget() {
        const maxX = arena.clientWidth - size;
        const maxY = arena.clientHeight - size;
        target.style.left = Math.floor(Math.random() * maxX) + 'px';
        target.style.top = Math.floor(Math.random() * maxY) + 'px';
    }

    moveTarget();
    if (moveSpeed > 0) targetMoveInterval = setInterval(moveTarget, moveSpeed);

    target.addEventListener('mousedown', () => {
        score++;
        scoreDisplay.textContent = score;
        playHitSound();
        clearInterval(targetMoveInterval);
        target.remove();
        spawnTarget();
    });

    arena.appendChild(target);
}

function endGame() {
    // --- NEW: Exit Fullscreen ---
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
    }
    // ----------------------------

    clearInterval(gameInterval);
    clearInterval(targetMoveInterval);
    arena.innerHTML = '';
    startBtn.disabled = false;
    startBtn.textContent = 'Play Again';
    checkHighScore(score);
}

// NEW: Checks the database to see if your score makes the top 5
async function checkHighScore(finalScore) {
    try {
        const response = await fetch(`${API_URL}/${currentPlayDifficulty}`);
        const topScores = await response.json();

        const lowestScore = topScores.length < 5 ? 0 : topScores[topScores.length - 1].score;

        if (finalScore > lowestScore || topScores.length < 5) {
            pendingScore = finalScore;
            finalScoreDisplay.textContent = finalScore;
            finalDiffDisplay.textContent = currentPlayDifficulty.toUpperCase();
            nameModal.classList.remove('hidden');
            playerNameInput.focus();
        } else {
            alert(`Time's up! Final Score: ${finalScore}. Keep practicing to hit the Global Top 5!`);
        }
    } catch (error) {
        console.error("Error connecting to database:", error);
        alert(`Time's up! Final Score: ${finalScore}. (Cannot connect to global server)`);
    }
}

// NEW: Saves the score to your MongoDB database
saveScoreBtn.addEventListener('click', async () => {
    const nameToSave = playerNameInput.value.trim() || 'Unknown';
    
    saveScoreBtn.disabled = true;
    saveScoreBtn.textContent = "Saving to Cloud...";

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameToSave,
                score: pendingScore,
                difficulty: currentPlayDifficulty
            })
        });
        
        await updateLeaderboard();
    } catch (error) {
        console.error("Failed to save score:", error);
        alert("Server error! Make sure your backend node server is running.");
    }

    saveScoreBtn.disabled = false;
    saveScoreBtn.textContent = "Save Score";
    nameModal.classList.add('hidden');
    playerNameInput.value = '';
});

// NEW: Pulls the newest scores from the database and updates the screen
async function updateLeaderboard() {
    highScoreList.innerHTML = '<li style="justify-content: center; color: #555;">Loading global scores...</li>';

    try {
        const response = await fetch(`${API_URL}/${currentViewDifficulty}`);
        const topScores = await response.json();

        highScoreList.innerHTML = '';

        if (topScores.length === 0) {
            highScoreList.innerHTML = '<li style="justify-content: center; color: #555;">No records yet. Be the first!</li>';
            return;
        }

        topScores.forEach(entry => {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('score-name');
            nameSpan.textContent = entry.name;

            const scoreSpan = document.createElement('span');
            scoreSpan.classList.add('score-value');
            scoreSpan.textContent = entry.score;

            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);
            highScoreList.appendChild(li);
        });
    } catch (error) {
        console.error("Failed to load leaderboard:", error);
        highScoreList.innerHTML = '<li style="justify-content: center; color: #ff3366;">Cannot connect to backend server.</li>';
    }
}

closeModalBtn.addEventListener('click', () => {
    nameModal.classList.add('hidden');
    playerNameInput.value = '';
});

startBtn.addEventListener('click', startGame);