/**
 * storage.js — Persistance locale (CDC §7)
 *
 * Abstraction sur localStorage et sessionStorage.
 * Toutes les données sont temporaires, côté client, sans serveur distant.
 *
 * localStorage  → données de session (partagées entre onglets)
 * sessionStorage → identité de l'utilisateur courant (propre à l'onglet)
 */

'use strict';

import { LS_SESSION_PREFIX, SS_ME_KEY } from './config.js';

/* ══════════════════════════════════════════════════
   SESSION — localStorage
   ══════════════════════════════════════════════════ */

/**
 * Sauvegarde une session dans localStorage.
 * @param {import('./config.js').Session} session
 */
export function saveSession(session) {
  try {
    localStorage.setItem(LS_SESSION_PREFIX + session.id, JSON.stringify(session));
  } catch (e) {
    console.error('[storage] saveSession:', e);
  }
}

/**
 * Charge une session depuis localStorage.
 * @param {string} sessionId
 * @returns {import('./config.js').Session|null}
 */
export function loadSession(sessionId) {
  try {
    const raw = localStorage.getItem(LS_SESSION_PREFIX + sessionId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[storage] loadSession:', e);
    return null;
  }
}

/**
 * Supprime une session de localStorage (CDC §5.3 — clôture par le facilitateur).
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
  localStorage.removeItem(LS_SESSION_PREFIX + sessionId);
}

/* ══════════════════════════════════════════════════
   IDENTITÉ UTILISATEUR — sessionStorage
   ══════════════════════════════════════════════════ */

/**
 * @typedef {Object} MeData
 * @property {string} myId       - Identifiant unique de l'onglet
 * @property {string} myName     - Nom de l'utilisateur
 * @property {string} myRole     - Rôle ('facilitator' | 'participant')
 * @property {string} sessionId  - Code de la session rejointe
 */

/**
 * Sauvegarde l'identité de l'utilisateur courant dans sessionStorage.
 * Permet la restauration après rechargement de page.
 * @param {MeData} data
 */
export function saveMe(data) {
  try {
    sessionStorage.setItem(SS_ME_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] saveMe:', e);
  }
}

/**
 * Charge l'identité de l'utilisateur courant depuis sessionStorage.
 * @returns {MeData|null}
 */
export function loadMe() {
  try {
    const raw = sessionStorage.getItem(SS_ME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('[storage] loadMe:', e);
    return null;
  }
}

/**
 * Supprime l'identité de l'utilisateur (déconnexion / clôture).
 */
export function clearMe() {
  sessionStorage.removeItem(SS_ME_KEY);
}
