/**
 * session.js — Cycle de vie des sessions (CDC §5)
 *
 * Gère : création, rejoindre, quitter, clôture.
 * Ce module est le seul à modifier l'état global de session.
 *
 * Règles métier implémentées :
 *  - 1 facilitateur par session (CDC §3.1)
 *  - Max 8 participants (CDC §3.2)
 *  - Nom obligatoire (CDC §3.2)
 *  - URL de session générée (CDC §5.1)
 *  - Messages d'erreur "Session complète" / "Session introuvable" (CDC §5.2)
 *  - Clôture réservée au facilitateur (CDC §5.3)
 */

'use strict';

import { STATUS, ROLE, MAX_PARTICIPANTS, MSG } from './config.js';
import { saveSession, loadSession, deleteSession, saveMe, clearMe } from './storage.js';
import { openChannel, closeChannel, broadcast, broadcastState } from './channel.js';

/* ══════════════════════════════════════════════════
   ÉTAT GLOBAL (singleton)
   Exporté en lecture pour les autres modules.
   ══════════════════════════════════════════════════ */

export const state = {
  myId:      null,   // Identifiant unique de cet onglet
  myName:    '',
  myRole:    '',     // ROLE.FACILITATOR | ROLE.PARTICIPANT
  sessionId: null,
  session:   null,   // Objet Session complet (cf. config.js)

  /* Callbacks injectés par app.js */
  onParticipantJoin:  null,
  onParticipantLeave: null,
  onSessionClosed:    null,
  onError:            null,
};

/* ══════════════════════════════════════════════════
   GÉNÉRATEURS D'IDENTIFIANTS
   ══════════════════════════════════════════════════ */

/**
 * Génère un code de session alphanumérique sans ambiguïté (CDC §5.1).
 * @param {number} len - Longueur du code (défaut : 4)
 * @returns {string}
 */
function _genSessionId(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: len },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Génère un identifiant unique par onglet (non lisible, usage interne).
 * @returns {string}
 */
function _genParticipantId() {
  return Math.random().toString(36).slice(2, 10);
}

/* ══════════════════════════════════════════════════
   URL DE SESSION (CDC §5.1)
   ══════════════════════════════════════════════════ */

/**
 * Lit le code de session depuis les paramètres d'URL.
 * @returns {string|null}
 */
export function getUrlSessionId() {
  return new URLSearchParams(window.location.search).get('session');
}

/**
 * Met à jour l'URL pour refléter la session courante.
 * @param {string} id
 */
export function setUrlSessionId(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', id);
  history.replaceState({}, '', url.toString());
}

/**
 * Supprime le paramètre session de l'URL.
 */
export function clearUrlSessionId() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  history.replaceState({}, '', url.toString());
}

/**
 * Construit l'URL d'invitation complète.
 * @returns {string} Ex: https://user.github.io/agile-poker-planning/?session=A3F7
 */
export function buildInviteUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('session', state.sessionId);
  return url.toString();
}

/* ══════════════════════════════════════════════════
   CRÉATION DE SESSION (CDC §5.1)
   ══════════════════════════════════════════════════ */

/**
 * Crée une nouvelle session.
 * Le créateur devient automatiquement facilitateur.
 *
 * @param {string} name       - Nom du facilitateur
 * @param {string} [item='']  - Premier item à estimer (optionnel)
 * @param {Function} onReady  - Callback appelé quand la session est prête
 * @param {Function} onRender - Callback de re-rendu
 * @returns {boolean} false si les données sont invalides
 */
export function createSession(name, item = '', onReady, onRender) {
  if (!name) return false;

  state.myId      = _genParticipantId();
  state.myName    = name;
  state.myRole    = ROLE.FACILITATOR;
  state.sessionId = _genSessionId(4);

  state.session = {
    id:              state.sessionId,
    facilitatorId:   state.myId,
    facilitatorName: name,
    status:          STATUS.WAITING,
    currentItem:     item,
    participants: [{
      id:            state.myId,
      name,
      vote:          null,
      isFacilitator: true,
    }],
    createdAt: Date.now(),
  };

  saveSession(state.session);
  saveMe({ myId: state.myId, myName: state.myName, myRole: state.myRole, sessionId: state.sessionId });
  setUrlSessionId(state.sessionId);
  openChannel(state.sessionId, state, onRender);
  onReady && onReady();
  return true;
}

/* ══════════════════════════════════════════════════
   REJOINDRE UNE SESSION (CDC §5.2)
   ══════════════════════════════════════════════════ */

/**
 * @typedef {Object} JoinResult
 * @property {boolean} success
 * @property {string}  [error]  - 'SESSION_NOT_FOUND' | 'SESSION_FULL' | 'NAME_REQUIRED' | 'CODE_REQUIRED'
 */

/**
 * Rejoint une session existante en tant que participant.
 *
 * @param {string}   code      - Code de session saisi
 * @param {string}   name      - Nom du participant
 * @param {Function} onReady   - Callback quand la salle est prête
 * @param {Function} onRender  - Callback de re-rendu
 * @returns {JoinResult}
 */
export function joinSession(code, name, onReady, onRender) {
  if (!name)         return { success: false, error: 'NAME_REQUIRED' };
  if (!code)         return { success: false, error: 'CODE_REQUIRED' };

  const existing = loadSession(code);
  if (!existing)     return { success: false, error: 'SESSION_NOT_FOUND' };

  const nonFac = existing.participants.filter(p => !p.isFacilitator);
  if (nonFac.length >= MAX_PARTICIPANTS) {
    return { success: false, error: 'SESSION_FULL' };
  }

  state.myId      = _genParticipantId();
  state.myName    = name;
  state.myRole    = ROLE.PARTICIPANT;
  state.sessionId = code;
  state.session   = existing;

  // Ajouter le participant localement avant la synchro
  state.session.participants.push({
    id:            state.myId,
    name,
    vote:          null,
    isFacilitator: false,
  });

  saveSession(state.session);
  saveMe({ myId: state.myId, myName: state.myName, myRole: state.myRole, sessionId: state.sessionId });
  setUrlSessionId(state.sessionId);
  openChannel(state.sessionId, state, onRender);

  // Notifier le facilitateur et demander l'état le plus récent
  broadcast(MSG.PARTICIPANT_JOIN, { pid: state.myId, name });
  broadcast(MSG.REQUEST_STATE);

  onReady && onReady();
  return { success: true };
}

/* ══════════════════════════════════════════════════
   ACTIONS FACILITATEUR (CDC §3.1)
   ══════════════════════════════════════════════════ */

/**
 * Met à jour l'intitulé de l'item en cours.
 * @param {string} item
 */
export function updateItem(item) {
  if (!state.session) return;
  state.session.currentItem = item;
  broadcastState();
}

/**
 * Lance un nouveau vote : remet les votes à null, passe en statut 'voting'.
 * (CDC §4.3 — étape 1)
 * @param {string} [item] - Item mis à jour avant lancement
 */
export function launchVote(item) {
  if (!state.session) return;
  if (item !== undefined) state.session.currentItem = item;
  state.session.status = STATUS.VOTING;
  state.session.participants.forEach(p => { p.vote = null; });
  broadcastState();
}

/**
 * Révèle les votes de tous les participants.
 * (CDC §4.3 — étape 4)
 */
export function revealVotes() {
  if (!state.session) return;
  state.session.status = STATUS.REVEALED;
  broadcastState();
}

/**
 * Relance un nouveau tour : réinitialise les votes, repasse en 'waiting'.
 * (CDC §4.3 — relancer un vote)
 */
export function newRound() {
  if (!state.session) return;
  state.session.status = STATUS.WAITING;
  state.session.participants.forEach(p => { p.vote = null; });
  broadcastState();
}

/**
 * Clôture la session : diffuse l'événement, supprime les données.
 * (CDC §5.3)
 */
export function closeSession() {
  if (!state.session) return;
  broadcast(MSG.SESSION_CLOSED);
  deleteSession(state.sessionId);
  clearMe();
  clearUrlSessionId();
  closeChannel();
  state.session   = null;
  state.sessionId = null;
}

/* ══════════════════════════════════════════════════
   ACTIONS PARTICIPANT (CDC §3.2)
   ══════════════════════════════════════════════════ */

/**
 * Enregistre le vote du participant courant.
 * Ne peut être appelé que pendant la phase 'voting'.
 * (CDC §4.2 — une seule carte sélectionnable)
 *
 * @param {number} value - Valeur Fibonacci sélectionnée
 * @returns {boolean} false si le vote n'est pas autorisé
 */
export function castVote(value) {
  if (!state.session) return false;
  if (state.myRole === ROLE.FACILITATOR) return false;
  if (state.session.status !== STATUS.VOTING) return false;

  const me = state.session.participants.find(p => p.id === state.myId);
  if (!me) return false;

  me.vote = value;
  saveSession(state.session); // Persistance locale
  broadcast(MSG.VOTE_CAST, { vote: value });
  return true;
}

/**
 * Le participant quitte la session.
 * Notifie le facilitateur et nettoie l'état local.
 */
export function leaveSession() {
  if (!state.session) return;
  broadcast(MSG.PARTICIPANT_LEAVE);
  clearMe();
  clearUrlSessionId();
  closeChannel();
  state.session   = null;
  state.sessionId = null;
}
