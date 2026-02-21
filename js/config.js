/**
 * config.js — Constantes et structure de données
 *
 * Centralise toutes les valeurs fixes de l'application :
 * suite Fibonacci, limites métier, clés de stockage, types de messages.
 */

'use strict';

/* ── Règles métier (CDC §4) ──────────────────────────────────────────── */

/** Suite de Fibonacci autorisée pour le vote (CDC §4.2) */
export const FIBONACCI = [0, 1, 2, 3, 5, 8, 13];

/** Nombre maximum de participants hors facilitateur (CDC §3.2) */
export const MAX_PARTICIPANTS = 8;

/* ── Statuts de session (CDC §4.3) ──────────────────────────────────── */

/**
 * @typedef {'waiting'|'voting'|'revealed'} SessionStatus
 *
 * - waiting  : session créée, vote pas encore lancé
 * - voting   : vote en cours, cartes masquées
 * - revealed : votes révélés, statistiques affichées
 */
export const STATUS = {
  WAITING:  'waiting',
  VOTING:   'voting',
  REVEALED: 'revealed',
};

/* ── Rôles utilisateur (CDC §3) ─────────────────────────────────────── */

/** @typedef {'facilitator'|'participant'} UserRole */
export const ROLE = {
  FACILITATOR: 'facilitator',
  PARTICIPANT:  'participant',
};

/* ── Clés de persistance (CDC §7) ───────────────────────────────────── */

/** Préfixe localStorage pour les données de session */
export const LS_SESSION_PREFIX = 'pps_session_';

/** Clé sessionStorage pour l'identité de l'utilisateur courant */
export const SS_ME_KEY = 'pps_me';

/* ── Types de messages BroadcastChannel (CDC §2) ────────────────────── */

/**
 * Énumération des types de messages échangés via BroadcastChannel.
 * Chaque message inclut toujours : { type, from: myId, ...payload }
 */
export const MSG = {
  /** Un participant demande à rejoindre (payload: { pid, name }) */
  PARTICIPANT_JOIN:  'participant_join',

  /** Synchronisation complète de l'état (payload: { state }) */
  STATE_SYNC:        'state_sync',

  /** Un participant a voté (payload: { vote }) */
  VOTE_CAST:         'vote_cast',

  /** Un participant quitte la session */
  PARTICIPANT_LEAVE: 'participant_leave',

  /** Le facilitateur clôture la session */
  SESSION_CLOSED:    'session_closed',

  /** Erreur adressée à un onglet spécifique (payload: { to, code }) */
  ERROR:             'error',

  /** Un participant demande l'état courant au facilitateur */
  REQUEST_STATE:     'request_state',
};

/** Codes d'erreur métier */
export const ERR = {
  SESSION_FULL:      'SESSION_FULL',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
};

/* ── Structure de données de session ────────────────────────────────── */

/**
 * @typedef {Object} Participant
 * @property {string}       id            - Identifiant unique de l'onglet
 * @property {string}       name          - Nom saisi par l'utilisateur
 * @property {number|null}  vote          - Valeur votée, null si pas encore voté
 * @property {boolean}      isFacilitator - true pour le facilitateur
 */

/**
 * @typedef {Object} Session
 * @property {string}          id              - Code de session (4 caractères)
 * @property {string}          facilitatorId   - myId du facilitateur
 * @property {string}          facilitatorName - Nom du facilitateur
 * @property {SessionStatus}   status          - Statut courant
 * @property {string}          currentItem     - Intitulé de l'item à estimer
 * @property {Participant[]}   participants    - Liste des participants
 * @property {number}          createdAt       - Timestamp de création
 */
