/**
 * config.js — Constantes et structure de données
 *
 * MSG (BroadcastChannel) supprimé — remplacé par WebRTC (webrtc.js).
 * Les types de messages sont désormais des chaînes littérales dans webrtc.js.
 */

'use strict';

/* ── Règles métier (CDC §4) ──────────────────────────────────────────── */

/** Suite de Fibonacci autorisée pour le vote (CDC §4.2) */
export const FIBONACCI = [0, 1, 2, 3, 5, 8, 13];

/** Nombre maximum de participants hors facilitateur (CDC §3.2) */
export const MAX_PARTICIPANTS = 8;

/* ── Statuts de session (CDC §4.3) ──────────────────────────────────── */

export const STATUS = {
  WAITING:  'waiting',
  VOTING:   'voting',
  REVEALED: 'revealed',
};

/* ── Rôles utilisateur (CDC §3) ─────────────────────────────────────── */

export const ROLE = {
  FACILITATOR: 'facilitator',
  PARTICIPANT:  'participant',
};

/* ── Clés de persistance (CDC §7) ───────────────────────────────────── */

/** Préfixe localStorage — conservé pour la restauration du facilitateur après F5 */
export const LS_SESSION_PREFIX = 'pps_session_';

/** Clé sessionStorage pour l'identité de l'utilisateur courant */
export const SS_ME_KEY = 'pps_me';

/* ── Codes d'erreur métier ───────────────────────────────────────────── */

export const ERR = {
  SESSION_FULL:      'SESSION_FULL',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
};

/* ── Typedefs JSDoc ──────────────────────────────────────────────────── */

/**
 * @typedef {'waiting'|'voting'|'revealed'} SessionStatus
 * @typedef {'facilitator'|'participant'}   UserRole
 *
 * @typedef {Object} Participant
 * @property {string}      id
 * @property {string}      name
 * @property {number|null} vote
 * @property {boolean}     isFacilitator
 *
 * @typedef {Object} Session
 * @property {string}        id
 * @property {string}        facilitatorId
 * @property {string}        facilitatorName
 * @property {SessionStatus} status
 * @property {string}        currentItem
 * @property {Participant[]} participants
 * @property {number}        createdAt
 */
