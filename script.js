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
let votingOpen = false;
let sessionRef = null;
let playersRef = null;
let votesRef = null;
let storyRef = null;
let votingStateRef = null;

// ==================== UTILITY FUNCTIONS ====================

function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Remove dangerous characters and limit length
    return input
        .trim()
        .slice(0, 200) // Max 200 characters
        .replace(/[<>\"'`]/g, ''); // Remove potentially dangerous chars
}

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
    currentSessionId = sanitizeInput(sessionId);
    currentPlayerName = sanitizeInput(playerName);
    currentPlayerRole = playerRole || 'participant';
    myPlayerId = getMyPlayerId();

    // Références Gun
    sessionRef = gun.get('poker_sessions').get(sessionId);
    playersRef = sessionRef.get('players');
    votesRef = sessionRef.get('votes');
    storyRef = sessionRef.get('story');
    votingStateRef = sessionRef.get('votingState');

    // Rejoindre la session
    joinAsPlayer();

    // Setup UI selon le rôle
    if (currentPlayerRole === 'facilitator') {
        setupFacilitatorUI();
    } else {
        setupParticipantUI();
    }

    // Setup listeners
    setupListeners();

    // Heartbeat pour maintenir la présence
    startHeartbeat();
}

function setupFacilitatorUI() {
    // Le facilitateur NE VOTE JAMAIS - pas de cartes !
    document.getElementById('votingSection').style.display = 'none';

    // Afficher la section facilitateur pour saisir la story
    document.getElementById('facilitatorStorySection').style.display = 'block';
    document.getElementById('participantStorySection').style.display = 'none';

    // Les actions sont visibles
    document.getElementById('actionsSection').style.display = 'flex';

    // Setup story input avec validation
    const storyInput = document.getElementById('storyInput');
    const openBtn = document.getElementById('openVoteBtn');
    const readyIndicator = document.getElementById('readyIndicator');

    let storyTimeout;
    storyInput.addEventListener('input', (e) => {
        clearTimeout(storyTimeout);
        const story = e.target.value.trim();

        // Activer le bouton seulement si story non vide
        if (story) {
            openBtn.disabled = false;
            openBtn.classList.add('btn-ready');
            readyIndicator.classList.remove('hidden');
        } else {
            openBtn.disabled = true;
            openBtn.classList.remove('btn-ready');
            readyIndicator.classList.add('hidden');
        }

        // Sauvegarder la story après 500ms
        storyTimeout = setTimeout(() => {
            storyRef.get('text').put(sanitizeInput(story));
        }, 500);
    });
}

function setupParticipantUI() {
    // Le participant peut voter (mais pas avant ouverture)
    document.getElementById('votingSection').style.display = 'block';
    renderCards();

    // Afficher la section participant
    document.getElementById('facilitatorStorySection').style.display = 'none';
    document.getElementById('participantStorySection').style.display = 'block';

    // Afficher le message d'attente par défaut
    document.getElementById('waitingForStory').classList.remove('hidden');
    document.getElementById('participantStoryDisplay').classList.add('hidden');

    // Les actions ne sont pas visibles pour les participants
    document.getElementById('actionsSection').style.display = 'none';
}

function joinAsPlayer() {
    playersRef.get(myPlayerId).put({
        name: sanitizeInput(currentPlayerName),
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
    if (!votingOpen) {
        showNotification('Le vote n\'est pas encore ouvert', 'warning');
        return;
    }

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

        // Activer le bouton révéler si au moins un vote
        if (currentPlayerRole === 'facilitator' && votingOpen) {
            votesRef.once((votes) => {
                const hasVotes = votes && Object.keys(votes).some(k => k !== '_' && k !== '#');
                const revealBtn = document.getElementById('revealBtn');
                if (revealBtn) {
                    revealBtn.disabled = !hasVotes;
                }
            });
        }

        if (votesRevealed) {
            displayResults();
        }
    });

    // Écouter la story
    storyRef.get('text').on((text) => {
        if (currentPlayerRole === 'participant' && text) {
            const currentStoryEl = document.getElementById('currentStory');
            if (currentStoryEl) {
                currentStoryEl.textContent = text;
            }
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

    // Écouter l'état d'ouverture du vote
    votingStateRef.get('open').on((open) => {
        votingOpen = !!open;

        if (currentPlayerRole === 'participant') {
            if (votingOpen) {
                // Cacher le message d'attente
                document.getElementById('waitingForStory').classList.add('hidden');
                // Afficher la story
                document.getElementById('participantStoryDisplay').classList.remove('hidden');
                // Afficher les cartes
                document.getElementById('votingSection').style.display = 'block';
                // Mettre à jour le statut
                const voteStatus = document.getElementById('voteStatus');
                if (voteStatus) {
                    voteStatus.textContent = 'Sélectionnez une carte pour voter';
                }
            } else {
                // Afficher le message d'attente
                document.getElementById('waitingForStory').classList.remove('hidden');
                // Cacher la story
                document.getElementById('participantStoryDisplay').classList.add('hidden');
                // Cacher les cartes
                document.getElementById('votingSection').style.display = 'none';
            }
        }

        if (currentPlayerRole === 'facilitator') {
            const openBtn = document.getElementById('openVoteBtn');
            if (openBtn) {
                openBtn.style.display = votingOpen ? 'none' : 'block';
            }
        }
    });
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
                    (hasVoted ? sanitizeHTML(hasVoted.value) : '❌') :
                    (hasVoted ? '✅' : '❓');

                const playerNameSpan = document.createElement('span');
                playerNameSpan.className = 'player-name';
                playerNameSpan.textContent = player.name;

                const playerVoteSpan = document.createElement('span');
                playerVoteSpan.className = 'player-vote';
                playerVoteSpan.innerHTML = voteIcon;

                playerCard.appendChild(playerNameSpan);
                playerCard.appendChild(playerVoteSpan);

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

function openVoting() {
    const storyInput = document.getElementById('storyInput');
    const story = sanitizeInput(storyInput.value);

    if (!story) {
        showNotification('Veuillez saisir une User Story', 'warning');
        storyInput.focus();
        return;
    }

    // Sauvegarder la story
    storyRef.get('text').put(story);

    // Ouvrir le vote
    votingStateRef.get('open').put(true);

    // Masquer le bouton "Ouvrir le vote"
    document.getElementById('openVoteBtn').style.display = 'none';

    // Désactiver l'input
    storyInput.disabled = true;

    showNotification('Vote ouvert ! Les participants peuvent maintenant voter', 'success');
}

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

    // Fermer le vote
    votingStateRef.get('open').put(false);

    // Réactiver l'input story et vider
    const storyInput = document.getElementById('storyInput');
    if (storyInput) {
        storyInput.disabled = false;
        storyInput.value = '';
        storyInput.focus();
    }

    // Réafficher le bouton "Ouvrir le vote"
    const openBtn = document.getElementById('openVoteBtn');
    if (openBtn) {
        openBtn.style.display = 'block';
        openBtn.disabled = true;
    }

    // Clear story
    storyRef.get('text').put('');

    // Clear local selection
    selectedCard = null;
    document.querySelectorAll('.poker-card').forEach(c => {
        c.classList.remove('selected');
    });

    // Update status
    const voteStatus = document.getElementById('voteStatus');
    if (voteStatus) {
        voteStatus.textContent = 'Sélectionnez une carte pour voter';
        voteStatus.className = 'vote-status';
    }

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

            const playerNameDiv = document.createElement('div');
            playerNameDiv.className = 'vote-player-name';
            playerNameDiv.textContent = vote.playerName;

            const voteValueDiv = document.createElement('div');
            voteValueDiv.className = 'vote-card-value';
            voteValueDiv.textContent = vote.value;

            voteCard.appendChild(playerNameDiv);
            voteCard.appendChild(voteValueDiv);
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