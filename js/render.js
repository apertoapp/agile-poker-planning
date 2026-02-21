/**
 * render.js — Rendu DOM (CDC §11)
 *
 * Toutes les fonctions qui mettent à jour le DOM en fonction de l'état courant.
 * Ce module ne modifie jamais l'état — il le lit uniquement.
 *
 * Fonctions exportées :
 *  renderRoom()           — point d'entrée principal, appelle tout le reste
 *  renderStory()          — affichage de l'item en cours
 *  renderStatus()         — barre de statut + indicateur de vote personnel
 *  renderParticipants()   — liste des participants + statuts de vote
 *  renderCards()          — grille de cartes Fibonacci
 *  renderResults()        — panneau de résultats après révélation
 *  renderFacilitatorControls() — état des boutons facilitateur
 */

'use strict';

import { FIBONACCI, STATUS, ROLE, MAX_PARTICIPANTS } from './config.js';
import { esc } from './ui.js';

/* ══════════════════════════════════════════════════
   POINT D'ENTRÉE PRINCIPAL
   ══════════════════════════════════════════════════ */

/**
 * Déclenche le rendu complet de la salle de vote.
 * @param {import('./config.js').Session} session
 * @param {string} myId
 * @param {string} myRole
 */
export function renderRoom(session, myId, myRole) {
  if (!session) return;
  renderStory(session);
  renderStatus(session, myId);
  renderParticipants(session, myId, myRole);
  renderCards(session, myId, myRole);
  renderResults(session);
  renderFacilitatorControls(session, myId, myRole);
}

/* ══════════════════════════════════════════════════
   ITEM EN COURS (CDC §11 — Zone item)
   ══════════════════════════════════════════════════ */

/**
 * Affiche l'intitulé de l'item à estimer.
 * @param {import('./config.js').Session} session
 */
export function renderStory(session) {
  const el = document.getElementById('story-display');
  if (!el) return;

  if (session.currentItem) {
    el.textContent = session.currentItem;
    el.classList.remove('placeholder');
  } else {
    el.textContent = 'Aucun item défini…';
    el.classList.add('placeholder');
  }

  // Pré-remplir le champ de saisie facilitateur
  const inp = document.getElementById('item-input');
  if (inp && !inp.value) inp.value = session.currentItem || '';
}

/* ══════════════════════════════════════════════════
   BARRE DE STATUT
   ══════════════════════════════════════════════════ */

const STATUS_LABELS = {
  [STATUS.WAITING]:  'En attente du facilitateur',
  [STATUS.VOTING]:   'Vote en cours…',
  [STATUS.REVEALED]: 'Votes révélés',
};

/**
 * Met à jour la barre de statut et l'indicateur de vote personnel.
 * @param {import('./config.js').Session} session
 * @param {string} myId
 */
export function renderStatus(session, myId) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  dot.className  = 'status-dot ' + session.status;
  text.textContent = STATUS_LABELS[session.status] || '';

  // Indicateur du vote personnel
  const ind = document.getElementById('my-vote-indicator');
  if (!ind) return;
  const me = session.participants.find(p => p.id === myId);
  if (me && me.vote !== null && session.status === STATUS.VOTING) {
    ind.innerHTML = `<span style="color:var(--gold);font-size:.75rem">
      Mon vote : <strong>${esc(me.vote)}</strong>
    </span>`;
  } else {
    ind.innerHTML = '';
  }
}

/* ══════════════════════════════════════════════════
   LISTE DES PARTICIPANTS (CDC §11)
   ══════════════════════════════════════════════════ */

/**
 * Met à jour la liste des participants dans la barre latérale.
 * @param {import('./config.js').Session} session
 * @param {string} myId
 * @param {string} myRole
 */
export function renderParticipants(session, myId, myRole) {
  const list  = document.getElementById('participants-list');
  const count = document.getElementById('participants-count');
  if (!list || !count) return;

  const nonFac = session.participants.filter(p => !p.isFacilitator);
  count.textContent = `${nonFac.length} / ${MAX_PARTICIPANTS}`;

  if (!session.participants.length) {
    list.innerHTML = '<div class="empty-state">Aucun participant…</div>';
    return;
  }

  list.innerHTML = session.participants.map(p => {
    const initial = esc(p.name[0].toUpperCase());
    const voteEl  = _buildVoteStatusEl(p, session.status);

    return `
      <div class="participant-item">
        <div class="participant-avatar">${initial}</div>
        <div style="flex:1;min-width:0">
          <div class="participant-name">${esc(p.name)}</div>
          <div class="participant-role">${p.isFacilitator ? 'facilitateur' : 'participant'}</div>
        </div>
        ${voteEl}
      </div>`;
  }).join('');
}

/**
 * Construit le badge de statut de vote d'un participant.
 * @param {import('./config.js').Participant} participant
 * @param {string} status
 * @returns {string} HTML
 */
function _buildVoteStatusEl(participant, status) {
  if (participant.isFacilitator) {
    return `<div class="vote-status not-voted" style="opacity:.3" title="Le facilitateur ne vote pas">F</div>`;
  }

  if (status === STATUS.REVEALED) {
    const val = participant.vote !== null ? esc(participant.vote) : '–';
    return `<div class="vote-status revealed" title="Vote révélé">${val}</div>`;
  }

  if (participant.vote !== null) {
    return `<div class="vote-status voted" title="A voté">✓</div>`;
  }

  return `<div class="vote-status not-voted" title="N'a pas encore voté">?</div>`;
}

/* ══════════════════════════════════════════════════
   CARTES DE VOTE (CDC §4.2 & §11)
   ══════════════════════════════════════════════════ */

/**
 * Rend la grille de cartes Fibonacci pour le participant.
 * @param {import('./config.js').Session} session
 * @param {string} myId
 * @param {string} myRole
 */
export function renderCards(session, myId, myRole) {
  const grid = document.getElementById('cards-grid');
  const hint = document.getElementById('waiting-hint');
  if (!grid) return;

  const me       = session.participants.find(p => p.id === myId);
  const disabled = session.status !== STATUS.VOTING || myRole === ROLE.FACILITATOR;

  grid.innerHTML = FIBONACCI.map(value => {
    const isSelected = me && me.vote === value;
    const classes = [
      'vote-card',
      isSelected ? 'selected' : '',
      disabled    ? 'disabled'  : '',
    ].filter(Boolean).join(' ');

    // onclick="castVote(n)" est géré dans app.js via délégation d'événements
    return `<div class="${classes}" data-value="${value}">${value}</div>`;
  }).join('');

  // Indicateur "en attente de révélation"
  if (!hint) return;
  const showHint = myRole === ROLE.PARTICIPANT
    && session.status === STATUS.VOTING
    && me && me.vote !== null;

  hint.style.display = showHint ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════
   RÉSULTATS (CDC §6)
   ══════════════════════════════════════════════════ */

/**
 * Affiche ou masque le panneau de résultats après révélation.
 * Calcule et affiche : moyenne, min, max, consensus.
 *
 * @param {import('./config.js').Session} session
 */
export function renderResults(session) {
  const panel = document.getElementById('results-panel');
  if (!panel) return;

  if (session.status !== STATUS.REVEALED) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';

  const voters = session.participants.filter(p => !p.isFacilitator && p.vote !== null);

  if (!voters.length) {
    panel.innerHTML = `
      <div class="results-title">◆ RÉSULTATS DU VOTE</div>
      <div class="empty-state">Aucun vote enregistré.</div>`;
    return;
  }

  // ── Calcul des statistiques ──
  const values  = voters.map(p => p.vote);
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const minVal  = Math.min(...values);
  const maxVal  = Math.max(...values);
  const consensus = values.every(v => v === values[0]);

  // ── Consensus ──
  const cb = document.getElementById('consensus-banner');
  if (cb) {
    cb.style.display = consensus ? 'block' : 'none';
    if (consensus) cb.textContent = `✦ CONSENSUS ATTEINT — Valeur : ${values[0]}`;
  }

  // ── Stats boxes ──
  const sg = document.getElementById('stats-grid');
  if (sg) {
    sg.innerHTML = `
      <div class="stat-box">
        <div class="stat-val">${average}</div>
        <div class="stat-label">Moyenne</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${minVal}</div>
        <div class="stat-label">Minimum</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${maxVal}</div>
        <div class="stat-label">Maximum</div>
      </div>`;
  }

  // ── Cartes retournées ──
  const rv = document.getElementById('revealed-votes');
  if (rv) {
    rv.innerHTML = voters.map((p, i) => {
      let colorClass = 'mid';
      if (maxVal !== minVal) {
        if (p.vote === maxVal) colorClass = 'high';
        if (p.vote === minVal) colorClass = 'low';
      }
      const delay = i * 80;
      return `
        <div class="revealed-card">
          <div class="revealed-card-val ${colorClass}"
               style="animation-delay:${delay}ms">${esc(p.vote)}</div>
          <div class="revealed-card-name" title="${esc(p.name)}">${esc(p.name)}</div>
        </div>`;
    }).join('');
  }
}

/* ══════════════════════════════════════════════════
   CONTRÔLES FACILITATEUR (CDC §3.1 & §11)
   ══════════════════════════════════════════════════ */

/**
 * Affiche/masque les contrôles selon le rôle et met à jour les états des boutons.
 * @param {import('./config.js').Session} session
 * @param {string} myId
 * @param {string} myRole
 */
export function renderFacilitatorControls(session, myId, myRole) {
  const facilitatorEl  = document.getElementById('facilitator-controls');
  const participantEl  = document.getElementById('participant-controls');
  if (!facilitatorEl || !participantEl) return;

  if (myRole !== ROLE.FACILITATOR) {
    facilitatorEl.style.display = 'none';
    participantEl.style.display = 'block';
    return;
  }

  facilitatorEl.style.display = 'block';
  participantEl.style.display = 'none';

  const nonFac   = session.participants.filter(p => !p.isFacilitator);
  const allVoted = nonFac.length > 0 && nonFac.every(p => p.vote !== null);

  const btnLaunch  = document.getElementById('btn-launch');
  const btnReveal  = document.getElementById('btn-reveal');
  const btnNewRnd  = document.getElementById('btn-newround');

  if (btnLaunch) btnLaunch.disabled = session.status === STATUS.VOTING;
  if (btnReveal) btnReveal.disabled = session.status !== STATUS.VOTING || nonFac.length === 0;
  if (btnNewRnd) btnNewRnd.disabled = session.status !== STATUS.REVEALED;

  // Débloquer "Révéler" dès que tous les participants ont voté
  if (btnReveal && allVoted && session.status === STATUS.VOTING) {
    btnReveal.disabled = false;
  }
}
