/**
 * ui.js — Helpers d'interface utilisateur
 *
 * Fonctions utilitaires indépendantes du domaine métier :
 *  - Navigation entre écrans
 *  - Notifications flottantes
 *  - Gestion des modals
 *  - Gestion des erreurs de formulaire
 *  - Sécurisation HTML (XSS)
 *  - Clipboard
 */

'use strict';

/* ══════════════════════════════════════════════════
   NAVIGATION ENTRE ÉCRANS
   ══════════════════════════════════════════════════ */

/**
 * Affiche l'écran demandé et masque les autres.
 * @param {'home'|'room'} screenName
 */
export function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + screenName);
  if (el) el.classList.add('active');
}

/* ══════════════════════════════════════════════════
   NOTIFICATIONS FLOTTANTES
   ══════════════════════════════════════════════════ */

let _notifTimer = null;

/**
 * Affiche une notification temporaire en haut à droite.
 * @param {string} message
 * @param {number} [duration=3000] - Durée en ms
 */
export function showNotif(message, duration = 3000) {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ══════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════ */

/**
 * Affiche un modal overlay.
 * @param {string} modalId - ID du div.overlay
 */
export function showModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('show');
}

/**
 * Masque un modal overlay.
 * @param {string} modalId
 */
export function hideModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('show');
}

/* ══════════════════════════════════════════════════
   MESSAGES D'ERREUR DE FORMULAIRE
   ══════════════════════════════════════════════════ */

/**
 * Affiche ou masque un message d'erreur sous un champ.
 * @param {string}      elementId - ID du div.error-msg
 * @param {string|null} message   - Texte d'erreur, ou null pour masquer
 */
export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

/**
 * Masque tous les messages d'erreur d'une liste d'IDs.
 * @param {string[]} ids
 */
export function clearErrors(...ids) {
  ids.forEach(id => showError(id, null));
}

/* ══════════════════════════════════════════════════
   EN-TÊTE UTILISATEUR
   ══════════════════════════════════════════════════ */

/**
 * Met à jour l'en-tête avec le nom et le rôle de l'utilisateur.
 * @param {string} name
 * @param {'facilitator'|'participant'} role
 * @param {string} sessionId
 */
export function renderHeader(name, role, sessionId) {
  const header = document.getElementById('app-header');
  const meta   = document.getElementById('header-meta');
  if (!header || !meta) return;

  header.style.display = 'flex';

  const badgeClass = role === 'facilitator' ? 'badge-facilitator' : 'badge-participant';
  const badgeLabel = role === 'facilitator' ? 'Facilitateur' : 'Participant';

  meta.innerHTML =
    `<strong>${esc(name)}</strong> &nbsp;` +
    `<span class="badge ${badgeClass}">${badgeLabel}</span><br>` +
    `<span style="font-size:.65rem">Session : <strong>${esc(sessionId)}</strong></span>`;
}

/**
 * Masque l'en-tête (écran d'accueil).
 */
export function hideHeader() {
  const header = document.getElementById('app-header');
  if (header) header.style.display = 'none';
}

/* ══════════════════════════════════════════════════
   CLIPBOARD
   ══════════════════════════════════════════════════ */

/**
 * Copie du texte dans le presse-papiers et affiche un toast de confirmation.
 * @param {string} text
 */
export function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('copy-toast');
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }).catch(err => {
    console.error('[ui] copyToClipboard:', err);
  });
}

/* ══════════════════════════════════════════════════
   SÉCURITÉ — ÉCHAPPEMENT HTML
   ══════════════════════════════════════════════════ */

/**
 * Échappe les caractères HTML spéciaux pour prévenir les injections XSS.
 * À utiliser sur toute donnée utilisateur insérée dans le DOM via innerHTML.
 *
 * @param {*} value - Valeur à sécuriser
 * @returns {string}
 */
export function esc(value) {
  return String(value)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
