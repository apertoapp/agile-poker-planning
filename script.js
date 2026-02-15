// Constants
const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13'];

// Global variables
let selectedCard = null;
let timerInterval = null;
let remainingTime = 0;

// Initialize localStorage if needed
function initStorage() {
    if (!localStorage.getItem('votes')) {
        localStorage.setItem('votes', JSON.stringify([]));
    }
    if (!localStorage.getItem('votingState')) {
        localStorage.setItem('votingState', JSON.stringify({
            started: false,
            endTime: null
        }));
    }
}

// Get or create participant ID
function getParticipantId() {
    let id = localStorage.getItem('participantId');
    if (!id) {
        id = 'P' + Math.random().toString(36).substr(2, 6).toUpperCase();
        localStorage.setItem('participantId', id);
    }
    return id;
}

// ==================== PARTICIPANT FUNCTIONS ====================

function initParticipant() {
    initStorage();
    renderParticipantCards();
    updateParticipantView();
    startTimerSync();

    // Setup vote button
    const voteBtn = document.getElementById('voteBtn');
    if (voteBtn) {
        voteBtn.addEventListener('click', submitVote);
    }

    // Update view periodically
    setInterval(updateParticipantView, 1000);
}

function renderParticipantCards() {
    const container = document.getElementById('participantCards');
    if (!container) return;

    container.innerHTML = '';

    CARD_VALUES.forEach(value => {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = value;
        card.addEventListener('click', () => selectCard(value, card));
        container.appendChild(card);
    });
}

function selectCard(value, cardElement) {
    const state = JSON.parse(localStorage.getItem('votingState'));
    if (!state.started) {
        showMessage('participantMessage', 'Le vote n\'a pas encore commencé', 'info');
        return;
    }

    const participantId = getParticipantId();
    const votes = JSON.parse(localStorage.getItem('votes'));
    const hasVoted = votes.some(v => v.participantId === participantId);

    if (hasVoted) {
        return;
    }

    // Remove selection from all cards
    document.querySelectorAll('#participantCards .card').forEach(c => {
        c.classList.remove('selected');
    });

    // Select clicked card
    cardElement.classList.add('selected');
    selectedCard = value;

    // Enable vote button
    const voteBtn = document.getElementById('voteBtn');
    if (voteBtn) {
        voteBtn.disabled = false;
    }
}

function submitVote() {
    if (!selectedCard) return;

    const participantId = getParticipantId();
    const votes = JSON.parse(localStorage.getItem('votes'));

    // Check if already voted
    if (votes.some(v => v.participantId === participantId)) {
        return;
    }

    // Add vote
    votes.push({
        participantId: participantId,
        value: selectedCard,
        timestamp: Date.now()
    });

    localStorage.setItem('votes', JSON.stringify(votes));

    // Disable all cards
    document.querySelectorAll('#participantCards .card').forEach(c => {
        c.classList.add('disabled');
        c.onclick = null;
    });

    // Disable vote button
    const voteBtn = document.getElementById('voteBtn');
    if (voteBtn) {
        voteBtn.disabled = true;
    }

    showMessage('participantMessage', '✓ Vote enregistré avec succès !', 'success');
}

function updateParticipantView() {
    const participantId = getParticipantId();
    const votes = JSON.parse(localStorage.getItem('votes'));
    const hasVoted = votes.some(v => v.participantId === participantId);

    if (hasVoted) {
        document.querySelectorAll('#participantCards .card').forEach(c => {
            c.classList.add('disabled');
            c.onclick = null;
        });

        const voteBtn = document.getElementById('voteBtn');
        if (voteBtn) {
            voteBtn.disabled = true;
        }

        showMessage('participantMessage', '✓ Vote enregistré avec succès !', 'success');
    }
}

// ==================== FACILITATOR FUNCTIONS ====================

function initFacilitator() {
    initStorage();
    updateFacilitatorView();
    startTimerSync();

    // Setup buttons
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startVoting);
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSession);
    }

    // Update view periodically
    setInterval(updateFacilitatorView, 1000);
}

function startVoting() {
    const timerInput = document.getElementById('timerInput');
    const duration = parseInt(timerInput.value) || 60;
    const endTime = Date.now() + (duration * 1000);

    // Reset votes and start new session
    localStorage.setItem('votes', JSON.stringify([]));
    localStorage.setItem('votingState', JSON.stringify({
        started: true,
        endTime: endTime
    }));

    // Update UI
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.disabled = true;

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.disabled = true;

    const votingStatus = document.getElementById('votingStatus');
    if (votingStatus) votingStatus.classList.remove('hidden');

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) resultsSection.classList.add('hidden');

    startTimerSync();
}

function resetSession() {
    localStorage.setItem('votes', JSON.stringify([]));
    localStorage.setItem('votingState', JSON.stringify({
        started: false,
        endTime: null
    }));

    // Update UI
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.disabled = false;

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.disabled = false;

    const votingStatus = document.getElementById('votingStatus');
    if (votingStatus) votingStatus.classList.add('hidden');

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) resultsSection.classList.add('hidden');

    stopTimer();

    const facilitatorTimer = document.getElementById('facilitatorTimer');
    if (facilitatorTimer) {
        facilitatorTimer.textContent = '--:--';
        facilitatorTimer.className = 'timer-display';
    }
}

function updateFacilitatorView() {
    const votes = JSON.parse(localStorage.getItem('votes'));
    const state = JSON.parse(localStorage.getItem('votingState'));

    const voteCount = document.getElementById('voteCount');
    if (voteCount) {
        voteCount.textContent = votes.length;
    }

    const votingStatusText = document.getElementById('votingStatusText');
    if (votingStatusText) {
        if (state.started) {
            votingStatusText.textContent = 'Vote en cours...';
        } else {
            votingStatusText.textContent = 'En attente...';
        }
    }
}

function showResults() {
    const votes = JSON.parse(localStorage.getItem('votes'));
    const container = document.getElementById('votesDisplay');

    if (!container) return;

    container.innerHTML = '';

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
        resultsSection.classList.remove('hidden');
    }

    const votingStatusText = document.getElementById('votingStatusText');
    if (votingStatusText) {
        votingStatusText.textContent = 'Vote terminé';
    }

    // Display all votes
    votes.forEach(vote => {
        const card = document.createElement('div');
        card.className = 'vote-card';
        card.innerHTML = `
            <div class="participant-id">${vote.participantId}</div>
            <div class="vote-value">${vote.value}</div>
        `;
        container.appendChild(card);
    });
}

// ==================== TIMER FUNCTIONS ====================

function startTimerSync() {
    stopTimer();

    timerInterval = setInterval(() => {
        const state = JSON.parse(localStorage.getItem('votingState'));

        if (!state.started) {
            stopTimer();
            return;
        }

        remainingTime = Math.max(0, state.endTime - Date.now());
        const seconds = Math.ceil(remainingTime / 1000);

        updateTimerDisplay(seconds);

        if (remainingTime <= 0) {
            stopTimer();
            onTimerEnd();
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const display = `${minutes}:${secs.toString().padStart(2, '0')}`;

    const participantTimer = document.getElementById('participantTimer');
    if (participantTimer) {
        participantTimer.textContent = display;
        participantTimer.className = seconds <= 10 ? 'timer-display warning' : 'timer-display';
    }

    const facilitatorTimer = document.getElementById('facilitatorTimer');
    if (facilitatorTimer) {
        facilitatorTimer.textContent = display;
        facilitatorTimer.className = seconds <= 10 ? 'timer-display warning' : 'timer-display';
    }
}

function onTimerEnd() {
    const state = JSON.parse(localStorage.getItem('votingState'));
    state.started = false;
    localStorage.setItem('votingState', JSON.stringify(state));

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.disabled = false;
    }

    showResults();
    playEndSound();
}

function playEndSound() {
    try {
        // Simple beep sound
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzOR0/LMhTAHG2Sz6eaZTwsNUrHm7q1cEgxBo+PyvmwhBzOR0/LMhTAHG2Sz6eaZTwsNUrHm7q1cEgxBo+PyvmwhBzOR0/LMhTAHG2Sz6eaZTwsNUrHm7q1cEgw=');
        audio.play();
    } catch (e) {
        console.log('Could not play sound:', e);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function showMessage(elementId, text, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `<div class="message ${type}">${text}</div>`;
}

// Initialize storage on load
initStorage();