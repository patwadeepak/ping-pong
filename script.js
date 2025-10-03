document.addEventListener('DOMContentLoaded', () => {
    // Game Elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Menu Elements
    const menuOverlay = document.getElementById('menu-overlay');
    const mainMenu = document.getElementById('main-menu');
    const difficultyMenu = document.getElementById('difficulty-menu');
    const highScoresScreen = document.getElementById('high-scores-screen');
    const optionsScreen = document.getElementById('options-screen');
    const aboutScreen = document.getElementById('about-screen');
    const gameOverScreen = document.getElementById('game-over-screen');

    // Audio Elements
    const menuMusic = document.getElementById('menu-music');
    const gameMusic = document.getElementById('game-music');
    const paddleHitSfx = document.getElementById('paddle-hit-sfx');

    // pause feature
    const pauseMenu = document.getElementById('pause-menu');
    const countdownOverlay = document.getElementById('countdown-overlay');

    // Game State
    let gameState = 'menu';
    let gameMode = 'singlePlayer';
    let difficulty = 'medium';
    let animationFrameId;
    let rallyCount = 0;
    const WINNING_SCORE = 5;

    // Audio State
    let musicEnabled = true;
    let sfxEnabled = true;

    // Game Objects (positions will be set dynamically)
    const paddleWidth = 15; // Slightly wider for better visibility
    let paddleHeight; // Will be set dynamically
    
    const player1 = { x: 30, y: 0, width: paddleWidth, height: 0, score: 0, speed: 6 }; // Speed reduced
    const player2 = { x: 0, y: 0, width: paddleWidth, height: 0, score: 0, speed: 6 }; // Speed reduced
    const ball = { x: 0, y: 0, radius: 10, speed: 4, dx: 2.5, dy: 2.5 }; // Speed reduced

    // AI Difficulty Settings
    const aiDifficulty = { easy: 0.3, medium: 0.15, hard: 0.01 };

    // Keyboard Input
    const keys = {};
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            togglePause();
        }
        keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // ## FULL SCREEN & RESIZE LOGIC ##
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Update paddle and ball sizes/positions based on new screen size
        paddleHeight = canvas.height / 6; // Make paddles responsive
        player1.height = paddleHeight;
        player2.height = paddleHeight;
        
        player1.y = canvas.height / 2 - paddleHeight / 2;
        player2.x = canvas.width - paddleWidth - 30;
        player2.y = canvas.height / 2 - paddleHeight / 2;

        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.radius = Math.min(canvas.width, canvas.height) * 0.015; // Responsive ball

        // Redraw if game is running
        if (gameState === 'playing') {
            draw();
        }
    }

    window.addEventListener('resize', resizeCanvas);

    // ## MENU NAVIGATION ##
    const showScreen = (screen) => {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
        menuOverlay.style.display = 'flex';
    };
    
    document.getElementById('single-player-btn').addEventListener('click', () => showScreen(difficultyMenu));
    document.getElementById('two-player-btn').addEventListener('click', () => startGame('twoPlayer'));
    document.getElementById('high-scores-btn').addEventListener('click', () => {
        displayHighScores();
        showScreen(highScoresScreen);
    });
    document.getElementById('options-btn').addEventListener('click', () => showScreen(optionsScreen));
    document.getElementById('about-btn').addEventListener('click', () => showScreen(aboutScreen));
    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => showScreen(mainMenu)));
    
    difficultyMenu.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.difficulty) {
            startGame('singlePlayer', e.target.dataset.difficulty);
        }
    });

    // ## OPTIONS ##
    document.getElementById('toggle-music-btn').addEventListener('click', () => {
        musicEnabled = !musicEnabled;
        document.getElementById('toggle-music-btn').textContent = `Music: ${musicEnabled ? 'ON' : 'OFF'}`;
        if (!musicEnabled) {
            menuMusic.pause(); gameMusic.pause();
        } else {
            if (gameState === 'menu') menuMusic.play(); else if (gameState === 'playing') gameMusic.play();
        }
    });
    document.getElementById('toggle-sfx-btn').addEventListener('click', () => {
        sfxEnabled = !sfxEnabled;
        document.getElementById('toggle-sfx-btn').textContent = `SFX: ${sfxEnabled ? 'ON' : 'OFF'}`;
    });

    // ## PAUSE LOGIC ##
    function togglePause() {
        // Only allow pausing if the game is actually running
        if (gameState === 'playing') {
            gameState = 'paused';
            if (musicEnabled) gameMusic.pause();
            showScreen(pauseMenu);
        }
    }

    function startCountdown() {
        countdownOverlay.style.display = 'block';
        let count = 3;

        // A function to update the text, to avoid repeating code
        const updateText = () => {
            if (count > 0) {
                countdownOverlay.textContent = count;
            } else {
                countdownOverlay.textContent = 'GO!';
            }
        };

        updateText(); // Show '3' immediately

        const countdown = setInterval(() => {
            count--;
            if (count >= 0) {
                updateText();
            } else {
                clearInterval(countdown);
                countdownOverlay.style.display = 'none';
                gameState = 'playing'; // Resume game logic
                if (musicEnabled) {
                    gameMusic.play();
                }
            }
        }, 700); // 0.7 seconds for a more dramatic countdown
    }

    // Safely find and add event listener for the Resume button
    const resumeBtn = document.getElementById('resume-btn');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            menuOverlay.style.display = 'none';
            startCountdown();
        });
    }

    // Safely find and add event listener for the Exit button
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            cancelAnimationFrame(animationFrameId); // Stop the current game
            gameState = 'menu';
            if(gameMusic) {
                gameMusic.pause();
                gameMusic.currentTime = 0;
            }
            if (musicEnabled) {
                menuMusic.play();
            }
            showScreen(mainMenu);
        });
    }

    // ## GAME LOGIC ##
    function startGame(mode, diff = 'medium') {
        gameMode = mode;
        difficulty = diff;
        gameState = 'playing';
        menuOverlay.style.display = 'none';
        
        resetGame();
        
        if (musicEnabled) {
            menuMusic.pause();
            gameMusic.currentTime = 0;
            gameMusic.playbackRate = 1;
            gameMusic.play();
        }

        gameLoop();
    }

    function resetGame() {
        player1.score = 0;
        player2.score = 0;
        resizeCanvas(); // Ensure positions are correct on game start
        resetBall();
    }

    function resetBall() {
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.speed = 10;
        ball.dx = (Math.random() > 0.5 ? 1 : -1) * 10;
        ball.dy = (Math.random() * 5) - 10;
        rallyCount = 0;
        if(musicEnabled) gameMusic.playbackRate = 1;
    }

    function update() {
        if (gameState !== 'playing') return;

        // Move Paddles
        if (keys['w'] && player1.y > 0) player1.y -= player1.speed;
        if (keys['s'] && player1.y < canvas.height - player1.height) player1.y += player1.speed;
        if (gameMode === 'twoPlayer') {
            if (keys['i'] && player2.y > 0) player2.y -= player2.speed;
            if (keys['k'] && player2.y < canvas.height - player2.height) player2.y += player2.speed;
        } else {
            moveAI();
        }

        // Move Ball
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Wall Collision (Top/Bottom)
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.dy *= -1;
            playSound(paddleHitSfx);
        }

        // Paddle Collision
        let player = (ball.x < canvas.width / 2) ? player1 : player2;
        if (isColliding(player, ball)) {
            let collidePoint = (ball.y - (player.y + player.height / 2));
            collidePoint = collidePoint / (player.height / 2);
            let angleRad = collidePoint * (Math.PI / 4);
            let direction = (ball.x < canvas.width / 2) ? 1 : -1;
            ball.dx = direction * ball.speed * Math.cos(angleRad);
            ball.dy = ball.speed * Math.sin(angleRad);
            
            ball.speed += 0.2; // Slower speed increase
            rallyCount++;
            if (rallyCount % 5 === 0 && musicEnabled) {
                 gameMusic.playbackRate += 0.005;
            }
            playSound(paddleHitSfx);
        }

        // Score Point
        if (ball.x - ball.radius < 0) {
            player2.score++;
            resetBall();
        } else if (ball.x + ball.radius > canvas.width) {
            player1.score++;
            resetBall();
        }

        // Check for Winner
        if (player1.score >= WINNING_SCORE || player2.score >= WINNING_SCORE) {
            endGame();
        }
    }

    function moveAI() {
        if (Math.random() < aiDifficulty[difficulty]) {
             player2.y += (Math.random() > 0.5 ? 5 : -5);
        } else {
            let targetY = ball.y - player2.height / 2;
            player2.y += (targetY - player2.y) * 0.08; // Slower reaction time
        }
        
        if (player2.y < 0) player2.y = 0;
        if (player2.y > canvas.height - player2.height) player2.y = canvas.height - player2.height;
    }

    function isColliding(paddle, ball) {
        return ball.x - ball.radius < paddle.x + paddle.width &&
               ball.x + ball.radius > paddle.x &&
               ball.y - ball.radius < paddle.y + paddle.height &&
               ball.y + ball.radius > paddle.y;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear for resize redraw
        
        // Draw middle line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw paddles
        ctx.fillStyle = '#fff';
        ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
        ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw scores
        ctx.font = '40px "Press Start 2P"';
        ctx.fillText(player1.score, canvas.width / 4, 50);
        ctx.fillText(player2.score, 3 * canvas.width / 4, 50);
    }
    
    function gameLoop() {
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function endGame() {
        gameState = 'gameOver';
        if (musicEnabled) gameMusic.pause();
        cancelAnimationFrame(animationFrameId);

        const winner = player1.score > player2.score ? "Player 1" : (gameMode === 'twoPlayer' ? "Player 2" : "CPU");
        document.getElementById('winner-text').textContent = `${winner} Wins!`;
        
        // HIGH SCORE LOGIC: This only runs if it's single player mode AND the human player wins.
        if (gameMode === 'singlePlayer' && player1.score > player2.score) {
            saveHighScore(player1.score);
        }

        showScreen(gameOverScreen);
        window.addEventListener('keydown', handleGameOverKey);
    }

    function handleGameOverKey(e) {
        if (e.key === 'Enter') {
            window.removeEventListener('keydown', handleGameOverKey);
            gameState = 'menu';
            showScreen(mainMenu);
            if(musicEnabled) menuMusic.play();
        }
    }

    // ## HIGH SCORE LOGIC ##
    function saveHighScore(score) {
        const scores = getHighScores();
        const newScore = { score, date: new Date().toLocaleDateString() };
        scores.push(newScore);
        scores.sort((a, b) => b.score - a.score);
        scores.splice(5);
        localStorage.setItem('pongHighScores', JSON.stringify(scores));
    }

    function getHighScores() {
        const scores = localStorage.getItem('pongHighScores');
        return scores ? JSON.parse(scores) : [];
    }

    function displayHighScores() {
        const scores = getHighScores();
        const list = document.getElementById('high-scores-list');
        list.innerHTML = '';
        if (scores.length === 0) {
            list.innerHTML = '<li>No scores yet!</li>';
        } else {
            scores.forEach(s => {
                const li = document.createElement('li');
                li.textContent = `Score: ${s.score} - Date: ${s.date}`;
                list.appendChild(li);
            });
        }
    }

    // ## UTILITY FUNCTIONS ##
    function playSound(sound) {
        if (sfxEnabled) {
            sound.currentTime = 0;
            sound.play().catch(e => console.error("SFX Error:", e));
        }
    }

    // Initial Setup
    resizeCanvas(); // Set initial size
    showScreen(mainMenu);
    if(musicEnabled) {
        menuMusic.volume = 0.5;
        gameMusic.volume = 0.5;
        menuMusic.play().catch(e => console.log("User interaction needed to play audio."));
    }
});