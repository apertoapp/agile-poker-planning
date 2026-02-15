// ==================== GUN.JS CONFIGURATION ====================

// Initialiser Gun avec des relais publics
const gun = Gun([
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gun-us.herokuapp.com/gun'
]);

// ==================== CONSTANTS ====================

const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '?', '☕'];

// ==================== GLOBAL VARIABLES ====================

let currentSessionId = null;
let currentPlayerName = null;
let currentPlayerRole = null;
let myPlayerId = null;
let selectedCard = null;
let votesRevealed = false;
let sessionRef = null;
let playersRef = null;
let votesRef = null;
let storyRef = null;

// ==================== UTILITY FUNCTIONS ====================

function generatePlayerId() {
    return 'p_' + Math.random().toString(36).substr(2, 9);
}

function getMyPlayerId() {
    if (!myPlayerId) {
        myPlayerId = localStorage.getItem('playerId');
        if (!myPlayerId) {
            myPlayerId = generatePlayerId();
            localStorage.setItem('playerId', myPlayerId);
        }
    }
    return myPlayerId;
}

// ==================== SESSION INITIALIZATION ====================

function initPokerSession(sessionId, playerName, playerRole) {
    currentSessionId = sessionId;
    currentPlayerName = playerName;
    currentPlayerRole = playerRole || 'participant';
    myPlayerId = getMyPlayerId();

    // Références Gun
    sessionRef = gun.get('poker_sessions').get(sessionId);
    playersRef = sessionRef.get('players');
    votesRef = sessionRef.get('votes');
    storyRef = sessionRef.get('story');

    // Rejoindre la session
    joinAsPlayer();

    // Setup UI
    renderCards();
    setupListeners();

    // Heartbeat pour maintenir la présence
    startHeartbeat();
}

function joinAsPlayer() {
    playersRef.get(myPlayerId).put({
        name: currentPlayerName,
        lastSeen: Date.now(),
        connected: true
    });

    // Nettoyer à la fermeture
    window.addEventListener('beforeunload', () => {
        playersRef.get(myPlayerId).get('connected').put(false);
    });
}

function startHeartbeat() {
    // Mettre à jour lastSeen toutes les 5 secondes
    setInterval(() => {
        playersRef.get(myPlayerId).get('lastSeen').put(Date.now());
    }, 5000);

    // Nettoyer les joueurs inactifs (> 30 secondes)
    setInterval(() => {
        playersRef.once((players) => {
            if (!players) return;
            const now = Date.now();
            Object.keys(players).forEach(key => {
                if (key === '_' || key === '#') return;
                const player = players[key];
                if (player && player.lastSeen && (now - player.lastSeen > 30000)) {
                    playersRef.get(key).put(null);
                }
            });
        });
    }, 10000);
}

// ==================== UI SETUP ====================

function renderCards() {
    const container = document.getElementById('cardsGrid');
    if (!container) return;

    container.innerHTML = '';

    CARD_VALUES.forEach(value => {
        const card = document.createElement('div');
        card.className = 'poker-card';
        card.textContent = value;
        card.dataset.value = value;
        card.addEventListener('click', () => selectCard(value, card));
        container.appendChild(card);
    });
}

function selectCard(value, cardElement) {
    if (votesRevealed) {
        showNotification('Les votes sont déjà révélés', 'warning');
        return;
    }

    // Remove selection from all cards
    document.querySelectorAll('.poker-card').forEach(c => {
        c.classList.remove('selected');
    });

    // Select clicked card
    cardElement.classList.add('selected');
    selectedCard = value;

    // Save vote
    votesRef.get(myPlayerId).put({
        value: value,
        playerName: currentPlayerName,
        timestamp: Date.now()
    });

    // Update status
    document.getElementById('voteStatus').textContent = `Vote enregistré: ${value}`;
    document.getElementById('voteStatus').className = 'vote-status voted';
}

function setupListeners() {
    // Écouter les joueurs
    playersRef.map().on((player, playerId) => {
        if (playerId === '_' || playerId === '#') return;
        updatePlayersList();
    });

    // Écouter les votes
    votesRef.map().on((vote, playerId) => {
        if (playerId === '_' || playerId === '#') return;
        updatePlayersList();
        if (votesRevealed) {
            displayResults();
        }
    });

    // Écouter la story
    storyRef.get('text').on((text) => {
        if (text && text !== document.getElementById('storyInput').value) {
            document.getElementById('storyInput').value = text;
        }
    });

    // Écouter l'état de révélation
    sessionRef.get('revealed').on((revealed) => {
        votesRevealed = !!revealed;
        if (votesRevealed) {
            displayResults();
        } else {
            hideResults();
        }
    });

    // Setup story input
    const storyInput = document.getElementById('storyInput');
    if (storyInput) {
        let storyTimeout;
        storyInput.addEventListener('input', (e) => {
            clearTimeout(storyTimeout);
            storyTimeout = setTimeout(() => {
                storyRef.get('text').put(e.target.value);
            }, 500);
        });
    }
}

function updatePlayersList() {
    playersRef.once((players) => {
        if (!players) return;

        const container = document.getElementById('playersList');
        const countEl = document.getElementById('playerCount');
        if (!container) return;

        container.innerHTML = '';

        let activeCount = 0;
        const now = Date.now();

        // Get votes
        votesRef.once((votes) => {
            Object.keys(players).forEach(key => {
                if (key === '_' || key === '#') return;

                const player = players[key];
                if (!player || !player.name) return;

                // Vérifier si actif (< 30 secondes)
                if (player.lastSeen && (now - player.lastSeen > 30000)) {
                    return;
                }

                activeCount++;

                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';

                const hasVoted = votes && votes[key];
                const voteIcon = votesRevealed ?
                    (hasVoted ? hasVoted.value : '❌') :
                    (hasVoted ? '✅' : '❓');

                playerCard.innerHTML = `
                    <span class="player-name">${player.name}</span>
                    <span class="player-vote">${voteIcon}</span>
                `;

                if (key === myPlayerId) {
                    playerCard.classList.add('current-player');
                }

                container.appendChild(playerCard);
            });

            if (countEl) countEl.textContent = activeCount;
        });
    });
}

// ==================== VOTING ACTIONS ====================

function revealVotes() {
    sessionRef.get('revealed').put(true);
    displayResults();
}

function resetVotes() {
    if (!confirm('Réinitialiser les votes pour une nouvelle story ?')) {
        return;
    }

    // Clear all votes
    votesRef.put({});

    // Clear revealed state
    sessionRef.get('revealed').put(false);

    // Clear local selection
    selectedCard = null;
    document.querySelectorAll('.poker-card').forEach(c => {
        c.classList.remove('selected');
    });

    // Update status
    document.getElementById('voteStatus').textContent = 'Sélectionnez une carte pour voter';
    document.getElementById('voteStatus').className = 'vote-status';

    // Hide results
    hideResults();

    showNotification('Votes réinitialisés', 'success');
}

function displayResults() {
    const resultsSection = document.getElementById('resultsSection');
    const votesGrid = document.getElementById('votesGrid');

    if (!resultsSection || !votesGrid) return;

    resultsSection.classList.remove('hidden');
    votesGrid.innerHTML = '';

    votesRef.once((votes) => {
        if (!votes) return;

        const voteValues = [];

        Object.keys(votes).forEach(key => {
            if (key === '_' || key === '#') return;

            const vote = votes[key];
            if (!vote || !vote.value) return;

            const voteCard = document.createElement('div');
            voteCard.className = 'vote-result-card';
            voteCard.innerHTML = `
                <div class="vote-player-name">${vote.playerName}</div>
                <div class="vote-card-value">${vote.value}</div>
            `;
            votesGrid.appendChild(voteCard);

            // Collect numeric values for stats
            const numValue = parseFloat(vote.value);
            if (!isNaN(numValue)) {
                voteValues.push(numValue);
            }
        });

        // Calculate statistics
        if (voteValues.length > 0) {
            const avg = (voteValues.reduce((a, b) => a + b, 0) / voteValues.length).toFixed(1);
            const sorted = [...voteValues].sort((a, b) => a - b);
            const median = sorted.length % 2 === 0
                ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
                : sorted[Math.floor(sorted.length / 2)].toFixed(1);

            const allSame = voteValues.every(v => v === voteValues[0]);
            const consensus = allSame ? '✅' : '⚠️';

            document.getElementById('avgValue').textContent = avg;
            document.getElementById('medianValue').textContent = median;
            document.getElementById('consensusValue').textContent = consensus;
        } else {
            document.getElementById('avgValue').textContent = '-';
            document.getElementById('medianValue').textContent = '-';
            document.getElementById('consensusValue').textContent = '-';
        }
    });
}

function hideResults() {
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
        resultsSection.classList.add('hidden');
    }
}

// ==================== SHARING ====================

function shareSession() {
    // URL pour les participants (par défaut)
    const baseUrl = window.location.origin + window.location.pathname.replace('poker.html', 'index.html');
    const url = `${baseUrl}?session=${currentSessionId}`;

    // Try native share API first
    if (navigator.share) {
        navigator.share({
            title: 'Planning Poker - Rejoindre la session',
            text: `Rejoignez ma session Planning Poker: ${currentSessionId}`,
            url: url
        }).catch(() => {
            copyToClipboard(url);
        });
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(text) {
    // Create temporary input
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);

    showNotification('URL copiée dans le presse-papier !', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}