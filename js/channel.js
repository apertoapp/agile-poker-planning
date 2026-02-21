/**
 * channel.js — Communication temps réel via BroadcastChannel API (CDC §2)
 *
 * Remplace un serveur WebSocket par une communication inter-onglets native.
 * Fonctionne sans serveur, directement dans le navigateur.
 *
 * Chaque message a la forme : { type, from: myId, ...payload }
 */

'use strict';

import { MSG, ERR, MAX_PARTICIPANTS, STATUS, ROLE } from './config.js';
import { saveSession, loadSession }                  from './storage.js';

/** @type {BroadcastChannel|null} */
let _channel = null;

/** Référence à l'état courant de l'application (injectée depuis session.js) */
let _state = null;

/** Callback de re-rendu à appeler après une mise à jour d'état */
let _onStateChange = null;

/* ══════════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════════ */

/**
 * Ouvre (ou rouvre) le canal BroadcastChannel pour une session donnée.
 *
 * @param {string}   sessionId     - Code de la session
 * @param {object}   stateRef      - Référence vers l'objet d'état partagé { myId, myRole, session }
 * @param {Function} onStateChange - Callback appelé après chaque mise à jour
 */
export function openChannel(sessionId, stateRef, onStateChange) {
  if (_channel) _channel.close();

  _state         = stateRef;
  _onStateChange = onStateChange;

  _channel           = new BroadcastChannel('pps_' + sessionId);
  _channel.onmessage = _onMessage;
}

/**
 * Ferme le canal proprement.
 */
export function closeChannel() {
  if (_channel) {
    _channel.close();
    _channel = null;
  }
}

/* ══════════════════════════════════════════════════
   ÉMISSION
   ══════════════════════════════════════════════════ */

/**
 * Diffuse un message à tous les onglets connectés à la même session.
 * @param {string} type     - Type de message (cf. MSG)
 * @param {object} payload  - Données supplémentaires
 */
export function broadcast(type, payload = {}) {
  if (!_channel || !_state) return;
  _channel.postMessage({ type, from: _state.myId, ...payload });
}

/**
 * Diffuse l'état complet de la session (facilitateur → tous).
 * Sauvegarde également dans localStorage avant diffusion.
 */
export function broadcastState() {
  if (!_state || _state.myRole !== ROLE.FACILITATOR) return;
  saveSession(_state.session);
  broadcast(MSG.STATE_SYNC, { state: _state.session });
  _onStateChange && _onStateChange();
}

/* ══════════════════════════════════════════════════
   RÉCEPTION
   ══════════════════════════════════════════════════ */

/**
 * Gestionnaire central des messages BroadcastChannel.
 * @param {MessageEvent} e
 */
function _onMessage(e) {
  const msg = e.data;
  if (!_state || !_state.session) return;
  if (msg.from === _state.myId) return; // Ignorer ses propres messages

  switch (msg.type) {

    /* ── Un nouveau participant veut rejoindre ── */
    case MSG.PARTICIPANT_JOIN: {
      if (_state.myRole !== ROLE.FACILITATOR) return;

      // Doublon ? (rechargement de page)
      if (_state.session.participants.find(p => p.id === msg.pid)) {
        broadcastState();
        break;
      }

      // Salle pleine (hors facilitateur)
      const nonFac = _state.session.participants.filter(p => !p.isFacilitator);
      if (nonFac.length >= MAX_PARTICIPANTS) {
        broadcast(MSG.ERROR, { to: msg.pid, code: ERR.SESSION_FULL });
        break;
      }

      _state.session.participants.push({
        id: msg.pid,
        name: msg.name,
        vote: null,
        isFacilitator: false,
      });

      broadcastState();
      _state.onParticipantJoin && _state.onParticipantJoin(msg.name);
      break;
    }

    /* ── Synchronisation d'état complète ── */
    case MSG.STATE_SYNC: {
      if (msg.state) {
        _state.session = msg.state;
        _onStateChange && _onStateChange();
      }
      break;
    }

    /* ── Un participant a voté ── */
    case MSG.VOTE_CAST: {
      if (_state.myRole !== ROLE.FACILITATOR) return;
      if (_state.session.status !== STATUS.VOTING) return;

      const voter = _state.session.participants.find(p => p.id === msg.from);
      if (voter) {
        voter.vote = msg.vote;
        broadcastState();
      }
      break;
    }

    /* ── Un participant quitte ── */
    case MSG.PARTICIPANT_LEAVE: {
      if (_state.myRole !== ROLE.FACILITATOR) return;

      _state.session.participants = _state.session.participants.filter(
        p => p.id !== msg.from
      );
      broadcastState();
      _state.onParticipantLeave && _state.onParticipantLeave();
      break;
    }

    /* ── Le facilitateur clôture la session ── */
    case MSG.SESSION_CLOSED: {
      if (msg.from !== _state.session.facilitatorId) break;
      _state.onSessionClosed && _state.onSessionClosed();
      break;
    }

    /* ── Erreur adressée à cet onglet ── */
    case MSG.ERROR: {
      if (msg.to !== _state.myId) break;
      _state.onError && _state.onError(msg.code);
      break;
    }

    /* ── Un participant demande l'état courant ── */
    case MSG.REQUEST_STATE: {
      if (_state.myRole !== ROLE.FACILITATOR) return;
      broadcastState();
      break;
    }

    default:
      break;
  }
}
