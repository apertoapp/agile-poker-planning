/**
 * webrtc.js — Transport temps réel via WebRTC + PeerJS (CDC §2)
 *
 * Remplace channel.js (BroadcastChannel), limité au même navigateur.
 * PeerJS est chargé comme script global dans index.html (window.Peer).
 *
 * Topologie en étoile :
 *   Participant A ──DataChannel──► Facilitateur (Peer hub)
 *   Participant B ──DataChannel──► Facilitateur
 *                 ◄──state_sync──
 *
 * Peer ID du facilitateur = 'pps-{sessionId}'  ex: 'pps-A3F7'
 * → Le code de session seul suffit pour se connecter, sans base de données.
 *
 * Messages Participant → Facilitateur :
 *   { type: 'participant_join',  pid, name }
 *   { type: 'vote_cast',        pid, vote }
 *   { type: 'participant_leave', pid }
 *
 * Messages Facilitateur → Participant(s) :
 *   { type: 'state_sync',    session }
 *   { type: 'session_closed' }
 */

'use strict';

import { saveSession }       from './storage.js';
import { STATUS, ROLE, MAX_PARTICIPANTS } from './config.js';

/* ── Préfixe des Peer IDs ─────────────────────────────────────────────*/
const PEER_PREFIX = 'pps-';

/* ── Singletons ──────────────────────────────────────────────────────*/
let _peer      = null;   // Notre instance PeerJS locale
let _hostConn  = null;   // Participant : connexion vers le facilitateur
let _connMap   = new Map(); // Facilitateur : peerJsId → { conn, appId }
let _state     = null;   // Référence vers l'état global (session.js)
let _onRender  = null;   // Callback de re-rendu
let _joinResolve = null; // Résolution de joinAsParticipant()
let _joinReject  = null; // Rejet de joinAsParticipant()

/* ══════════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════════ */

/**
 * Injecte les références d'état et de rendu.
 * @param {object}   stateRef - État global de session.js
 * @param {Function} onRender - Callback de re-rendu
 */
export function initWebRTC(stateRef, onRender) {
  _state    = stateRef;
  _onRender = onRender;
}

/* ══════════════════════════════════════════════════
   FACILITATEUR — Créer un Peer avec ID déterministe
   ══════════════════════════════════════════════════ */

/**
 * Crée le Peer du facilitateur avec l'ID 'pps-{sessionId}'.
 * Commence à écouter les connexions entrantes dès l'ouverture.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}  Résout quand le Peer est prêt
 * @throws {{ code: 'ID_TAKEN'|'PEER_ERROR' }}
 */
export function createFacilitatorPeer(sessionId) {
  return new Promise((resolve, reject) => {
    _peer = new Peer(PEER_PREFIX + sessionId, { debug: 1 });

    _peer.on('open', () => {
      _peer.on('connection', _onIncomingConnection);
      resolve();
    });

    _peer.on('error', (err) => {
      const code = err.type === 'unavailable-id' ? 'ID_TAKEN' : 'PEER_ERROR';
      reject({ code, original: err });
    });
  });
}

/* ── Connexion entrante (côté facilitateur) ──────────────────────────*/

function _onIncomingConnection(conn) {
  conn.on('open', () => {
    // Envoyer immédiatement l'état courant au nouveau venu
    _sendTo(conn, { type: 'state_sync', session: _state.session });
  });

  conn.on('data',  (msg) => _onParticipantMessage(conn, msg));
  conn.on('close', ()    => _onParticipantDisconnect(conn));
  conn.on('error', ()    => _onParticipantDisconnect(conn));
}

function _onParticipantMessage(conn, msg) {
  if (!_state?.session) return;

  switch (msg.type) {

    case 'participant_join': {
      _connMap.set(conn.peer, { conn, appId: msg.pid });

      // Éviter les doublons (rechargement de page)
      const exists = _state.session.participants.find(p => p.id === msg.pid);
      if (!exists) {
        const nonFac = _state.session.participants.filter(p => !p.isFacilitator);
        if (nonFac.length >= MAX_PARTICIPANTS) {
          _sendTo(conn, { type: 'error', code: 'SESSION_FULL' });
          conn.close();
          break;
        }
        _state.session.participants.push(
          { id: msg.pid, name: msg.name, vote: null, isFacilitator: false }
        );
        _state.onParticipantJoin?.(msg.name);
      }
      saveSession(_state.session);
      broadcastState();
      break;
    }

    case 'vote_cast': {
      if (_state.session.status !== STATUS.VOTING) break;
      const voter = _state.session.participants.find(p => p.id === msg.pid);
      if (voter) {
        voter.vote = msg.vote;
        saveSession(_state.session);
        broadcastState();
      }
      break;
    }

    case 'participant_leave': {
      _removeParticipant(msg.pid);
      _connMap.delete(conn.peer);
      break;
    }
  }
}

function _onParticipantDisconnect(conn) {
  const entry = _connMap.get(conn.peer);
  if (entry) {
    _removeParticipant(entry.appId);
    _connMap.delete(conn.peer);
  }
}

function _removeParticipant(appId) {
  if (!_state?.session) return;
  const before = _state.session.participants.length;
  _state.session.participants =
    _state.session.participants.filter(p => p.id !== appId);
  if (_state.session.participants.length < before) {
    saveSession(_state.session);
    broadcastState();
    _state.onParticipantLeave?.();
  }
}

/* ══════════════════════════════════════════════════
   PARTICIPANT — Se connecter au facilitateur
   ══════════════════════════════════════════════════ */

/**
 * Crée un Peer participant (ID aléatoire) et se connecte au facilitateur.
 * La Promise résout après réception du premier state_sync.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 * @throws {{ code: 'SESSION_NOT_FOUND'|'SESSION_FULL'|'PEER_ERROR' }}
 */
export function joinAsParticipant(sessionId) {
  return new Promise((resolve, reject) => {
    _joinResolve = resolve;
    _joinReject  = reject;

    _peer = new Peer({ debug: 1 }); // ID aléatoire pour le participant

    _peer.on('open', () => {
      _hostConn = _peer.connect(PEER_PREFIX + sessionId, { reliable: true });

      _hostConn.on('open', () => {
        // Se présenter au facilitateur
        _sendTo(_hostConn, {
          type: 'participant_join',
          pid:  _state.myId,
          name: _state.myName,
        });
      });

      _hostConn.on('data',  _onFacilitatorMessage);
      _hostConn.on('close', () => _state?.onSessionClosed?.());
      _hostConn.on('error', (err) => {
        _joinReject?.({ code: 'PEER_ERROR', original: err });
        _joinReject = null;
      });
    });

    // 'peer-unavailable' = facilitateur absent = code invalide
    _peer.on('error', (err) => {
      const code = err.type === 'peer-unavailable'
        ? 'SESSION_NOT_FOUND'
        : 'PEER_ERROR';
      _joinReject?.({ code, original: err });
      _joinReject = null;
    });
  });
}

function _onFacilitatorMessage(msg) {
  switch (msg.type) {

    case 'state_sync': {
      _state.session = msg.session;
      if (_joinResolve) {
        // Premier sync : la salle est prête
        const res = _joinResolve;
        _joinResolve = null;
        _joinReject  = null;
        res();
      } else {
        // Syncs suivants : mise à jour de l'UI
        _onRender?.();
      }
      break;
    }

    case 'session_closed': {
      _state?.onSessionClosed?.();
      break;
    }

    case 'error': {
      _joinReject?.({ code: msg.code });
      _joinReject  = null;
      _joinResolve = null;
      break;
    }
  }
}

/* ══════════════════════════════════════════════════
   DIFFUSION & ENVOI
   ══════════════════════════════════════════════════ */

/**
 * Facilitateur → tous les participants + re-rendu local.
 */
export function broadcastState() {
  if (!_state?.session) return;
  const msg = { type: 'state_sync', session: _state.session };
  _connMap.forEach(({ conn }) => {
    if (conn.open) _sendTo(conn, msg);
  });
  _onRender?.();
}

/**
 * Participant → facilitateur.
 * @param {object} data
 */
export function sendToFacilitator(data) {
  if (_hostConn?.open) _sendTo(_hostConn, data);
}

/** Notifie tous les participants de la clôture puis ferme les connexions. */
export function broadcastClose() {
  const msg = { type: 'session_closed' };
  _connMap.forEach(({ conn }) => {
    if (conn.open) { _sendTo(conn, msg); conn.close(); }
  });
  _connMap.clear();
}

function _sendTo(conn, data) {
  try { conn.send(data); } catch (e) { console.warn('[webrtc] send:', e); }
}

/* ══════════════════════════════════════════════════
   DÉCONNEXION
   ══════════════════════════════════════════════════ */

/**
 * Ferme toutes les connexions et détruit le Peer local.
 */
export function disconnectWebRTC() {
  if (_hostConn) { _hostConn.close(); _hostConn = null; }
  _connMap.clear();
  if (_peer)     { _peer.destroy();   _peer = null; }
  _joinResolve = null;
  _joinReject  = null;
}
