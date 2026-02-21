/**
 * session.js — Cycle de vie des sessions (CDC §5)
 *
 * Logique métier pure. Transport délégué à webrtc.js.
 *
 * Différence clé vs. version BroadcastChannel :
 *   ✗ loadSession() pour vérifier l'existence (localStorage = même navigateur)
 *   ✓ joinAsParticipant() tente une connexion WebRTC P2P
 *      → 'peer-unavailable' si le code est invalide (cross-navigateur)
 *
 *   createSession() et joinSession() sont async (handshake WebRTC).
 *   Les actions en salle (launchVote, castVote…) restent synchrones
 *   car l'envoi sur un DataChannel ouvert est immédiat.
 */

'use strict';

import { STATUS, ROLE, MAX_PARTICIPANTS } from './config.js';
import { saveSession, loadSession, deleteSession, saveMe, clearMe } from './storage.js';
import {
  initWebRTC,
  createFacilitatorPeer, joinAsParticipant,
  broadcastState, sendToFacilitator,
  broadcastClose, disconnectWebRTC,
} from './webrtc.js';

/* ══════════════════════════════════════════════════
   ÉTAT GLOBAL (singleton)
   ══════════════════════════════════════════════════ */

export const state = {
  myId:      null,
  myName:    '',
  myRole:    '',
  sessionId: null,
  session:   null,

  // Callbacks UI — injectés par app.js, utilisés par webrtc.js
  onParticipantJoin:  null,
  onParticipantLeave: null,
  onSessionClosed:    null,
  onError:            null,
};

/* ══════════════════════════════════════════════════
   GÉNÉRATEURS
   ══════════════════════════════════════════════════ */

function _genSessionId(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: len },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function _genParticipantId() {
  return Math.random().toString(36).slice(2, 10);
}

/* ══════════════════════════════════════════════════
   URL DE SESSION (CDC §5.1)
   ══════════════════════════════════════════════════ */

export function getUrlSessionId() {
  return new URLSearchParams(window.location.search).get('session');
}

export function setUrlSessionId(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', id);
  history.replaceState({}, '', url.toString());
}

export function clearUrlSessionId() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  history.replaceState({}, '', url.toString());
}

export function buildInviteUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('session', state.sessionId);
  return url.toString();
}

/* ══════════════════════════════════════════════════
   CRÉATION DE SESSION (CDC §5.1)
   ══════════════════════════════════════════════════ */

/**
 * Crée une session et en devient le facilitateur.
 * Génère un nouveau code si le Peer ID est déjà pris (collision rare).
 *
 * @param {string}   name
 * @param {string}   item
 * @param {Function} onReady
 * @param {Function} onRender
 * @returns {Promise<boolean>}
 */
export async function createSession(name, item = '', onReady, onRender) {
  if (!name) return false;

  initWebRTC(state, onRender);

  // Tenter jusqu'à 5 codes différents en cas de collision
  let sessionId;
  for (let i = 0; i < 5; i++) {
    sessionId = _genSessionId(4);
    try {
      await createFacilitatorPeer(sessionId);
      break; // succès
    } catch (e) {
      if (e.code === 'ID_TAKEN' && i < 4) continue;
      console.error('[session] createFacilitatorPeer:', e);
      return false;
    }
  }

  state.myId      = _genParticipantId();
  state.myName    = name;
  state.myRole    = ROLE.FACILITATOR;
  state.sessionId = sessionId;

  state.session = {
    id:              sessionId,
    facilitatorId:   state.myId,
    facilitatorName: name,
    status:          STATUS.WAITING,
    currentItem:     item,
    participants:    [{ id: state.myId, name, vote: null, isFacilitator: true }],
    createdAt:       Date.now(),
  };

  saveSession(state.session);
  saveMe({ myId: state.myId, myName: state.myName, myRole: state.myRole, sessionId });
  setUrlSessionId(sessionId);
  onReady?.();
  return true;
}

/* ══════════════════════════════════════════════════
   REJOINDRE UNE SESSION (CDC §5.2)
   ══════════════════════════════════════════════════ */

/**
 * Rejoint une session en tant que participant via WebRTC.
 *
 * Flux :
 *  1. Créer un Peer aléatoire
 *  2. Connexion au Peer facilitateur (ID = 'pps-CODE')
 *     → 'peer-unavailable' si le code est invalide
 *  3. Envoi de participant_join
 *  4. Réception de state_sync → Promise résolue → salle prête
 *
 * @param {string}   code
 * @param {string}   name
 * @param {Function} onReady
 * @param {Function} onRender
 * @returns {Promise<{success:boolean, error?:string}>}
 */
export async function joinSession(code, name, onReady, onRender) {
  if (!name) return { success: false, error: 'NAME_REQUIRED' };
  if (!code) return { success: false, error: 'CODE_REQUIRED' };

  state.myId   = _genParticipantId();
  state.myName = name;
  state.myRole = ROLE.PARTICIPANT;

  initWebRTC(state, onRender);

  try {
    await joinAsParticipant(code);
    // state.session a été rempli par webrtc.js lors du premier state_sync
  } catch (e) {
    disconnectWebRTC();
    const error = e.code === 'SESSION_NOT_FOUND' ? 'SESSION_NOT_FOUND'
                : e.code === 'SESSION_FULL'      ? 'SESSION_FULL'
                :                                  'PEER_ERROR';
    return { success: false, error };
  }

  state.sessionId = code;
  saveMe({ myId: state.myId, myName: state.myName, myRole: state.myRole, sessionId: code });
  setUrlSessionId(code);
  onReady?.();
  return { success: true };
}

/* ══════════════════════════════════════════════════
   RESTAURATION APRÈS RECHARGEMENT
   ══════════════════════════════════════════════════ */

/**
 * Restaure la session après un F5.
 *
 * Facilitateur : recrée le Peer avec le même ID + restaure depuis localStorage.
 * Participant  : reconnecte au facilitateur via WebRTC.
 *
 * @param {object}   me       - { myId, myName, myRole, sessionId }
 * @param {Function} onReady
 * @param {Function} onRender
 * @returns {Promise<boolean>}
 */
export async function restoreSession(me, onReady, onRender) {
  initWebRTC(state, onRender);

  state.myId      = me.myId;
  state.myName    = me.myName;
  state.myRole    = me.myRole;
  state.sessionId = me.sessionId;

  if (me.myRole === ROLE.FACILITATOR) {
    const saved = loadSession(me.sessionId);
    if (!saved) return false;
    state.session = saved;

    try {
      await createFacilitatorPeer(me.sessionId);
    } catch (e) {
      if (e.code === 'ID_TAKEN') {
        // L'ancien Peer est encore vivant côté serveur de signalisation.
        // Attendre 3s puis réessayer une fois.
        await new Promise(r => setTimeout(r, 3000));
        try { await createFacilitatorPeer(me.sessionId); }
        catch (_) { return false; }
      } else { return false; }
    }

    setUrlSessionId(me.sessionId);
    onReady?.();
    return true;

  } else {
    // Participant : reconnexion WebRTC
    try {
      await joinAsParticipant(me.sessionId);
    } catch (_) { return false; }

    setUrlSessionId(me.sessionId);
    onReady?.();
    return true;
  }
}

/* ══════════════════════════════════════════════════
   ACTIONS FACILITATEUR — synchrones (DataChannel immédiat)
   ══════════════════════════════════════════════════ */

/** Met à jour l'item sans relancer le vote. */
export function updateItem(item) {
  if (!state.session) return;
  state.session.currentItem = item;
  saveSession(state.session);
  broadcastState();
}

/** Lance un vote : reset des votes + statut → 'voting'. */
export function launchVote(item) {
  if (!state.session) return;
  if (item !== undefined) state.session.currentItem = item;
  state.session.status = STATUS.VOTING;
  state.session.participants.forEach(p => { p.vote = null; });
  saveSession(state.session);
  broadcastState();
}

/** Révèle les votes. */
export function revealVotes() {
  if (!state.session) return;
  state.session.status = STATUS.REVEALED;
  saveSession(state.session);
  broadcastState();
}

/** Réinitialise pour un nouveau tour. */
export function newRound() {
  if (!state.session) return;
  state.session.status = STATUS.WAITING;
  state.session.participants.forEach(p => { p.vote = null; });
  saveSession(state.session);
  broadcastState();
}

/** Clôture la session : notifie tous et nettoie. */
export function closeSession() {
  if (!state.session) return;
  const id = state.sessionId;
  broadcastClose();
  disconnectWebRTC();
  deleteSession(id);
  clearMe();
  clearUrlSessionId();
  state.session   = null;
  state.sessionId = null;
}

/* ══════════════════════════════════════════════════
   ACTIONS PARTICIPANT — synchrones
   ══════════════════════════════════════════════════ */

/**
 * Vote pour une valeur Fibonacci.
 * Mise à jour locale immédiate + envoi au facilitateur.
 * @param {number} value
 * @returns {boolean}
 */
export function castVote(value) {
  if (!state.session)                         return false;
  if (state.myRole === ROLE.FACILITATOR)      return false;
  if (state.session.status !== STATUS.VOTING) return false;

  const me = state.session.participants.find(p => p.id === state.myId);
  if (!me) return false;

  me.vote = value;
  sendToFacilitator({ type: 'vote_cast', pid: state.myId, vote: value });
  return true;
}

/** Quitte la session proprement. */
export function leaveSession() {
  if (!state.session) return;
  sendToFacilitator({ type: 'participant_leave', pid: state.myId });
  disconnectWebRTC();
  clearMe();
  clearUrlSessionId();
  state.session   = null;
  state.sessionId = null;
}
