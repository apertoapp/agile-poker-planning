/**
 * app.js — Point d'entrée de l'application
 *
 * Câble les événements DOM aux fonctions de session.js.
 * Aucune logique métier ici — uniquement du câblage.
 *
 * Changements vs. version BroadcastChannel :
 *   - Plus d'imports channel.js / MSG
 *   - createSession et joinSession sont async → handlers async
 *   - Actions en salle (launchVote, castVote…) restent synchrones
 *   - Restauration via restoreSession() async
 */

'use strict';

import { ROLE }                              from './config.js';
import { loadMe, clearMe }                   from './storage.js';
import {
  state,
  createSession, joinSession, restoreSession,
  leaveSession,  closeSession,
  updateItem,    launchVote, revealVotes, newRound, castVote,
  getUrlSessionId, buildInviteUrl,
} from './session.js';
import { renderRoom }                        from './render.js';
import {
  showScreen, showNotif, showModal, hideModal,
  showError,  clearErrors, renderHeader, hideHeader,
  copyToClipboard,
} from './ui.js';

/* ══════════════════════════════════════════════════
   CALLBACK DE RE-RENDU
   ══════════════════════════════════════════════════ */

function onRender() {
  renderRoom(state.session, state.myId, state.myRole);
}

/* ══════════════════════════════════════════════════
   CALLBACK "SALLE PRÊTE"
   ══════════════════════════════════════════════════ */

function onRoomReady() {
  showScreen('room');
  renderHeader(state.myName, state.myRole, state.sessionId);

  const linkPanel = document.getElementById('session-link-panel');
  const linkInput = document.getElementById('session-link-input');
  if (state.myRole === ROLE.FACILITATOR && linkPanel && linkInput) {
    linkPanel.style.display = 'block';
    linkInput.value = buildInviteUrl();
  }

  onRender();
}

/* ══════════════════════════════════════════════════
   CALLBACKS RÉSEAU (injectés dans state pour webrtc.js)
   ══════════════════════════════════════════════════ */

state.onParticipantJoin  = (name) => showNotif(`${name} a rejoint la session`);
state.onParticipantLeave = ()     => showNotif('Un participant a quitté la session');

state.onSessionClosed = () => {
  hideHeader();
  showScreen('home');
  showNotif('La session a été clôturée.');
};

/* ══════════════════════════════════════════════════
   CRÉER UNE SESSION — async (CDC §5.1)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-create-session')
  ?.addEventListener('click', async () => {
    const name = document.getElementById('create-name')?.value.trim() ?? '';
    const item = document.getElementById('create-item')?.value.trim() ?? '';
    clearErrors('err-create-name');

    if (!name) { showError('err-create-name', 'Veuillez saisir votre nom.'); return; }

    const btn = document.getElementById('btn-create-session');
    btn.disabled    = true;
    btn.textContent = 'Création…';

    const ok = await createSession(name, item, onRoomReady, onRender);

    btn.disabled    = false;
    btn.textContent = 'Créer la session';

    if (!ok) showError('err-create-name', 'Impossible de créer la session. Réessayez.');
  });

/* ══════════════════════════════════════════════════
   REJOINDRE UNE SESSION — async (CDC §5.2)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-join-session')
  ?.addEventListener('click', async () => {
    const code = document.getElementById('join-code')?.value.trim().toUpperCase() ?? '';
    const name = document.getElementById('join-name')?.value.trim() ?? '';
    clearErrors('err-join-code', 'err-join-name');

    const btn = document.getElementById('btn-join-session');
    btn.disabled    = true;
    btn.textContent = 'Connexion…';

    const result = await joinSession(code, name, onRoomReady, onRender);

    btn.disabled    = false;
    btn.textContent = 'Rejoindre';

    if (!result.success) {
      const messages = {
        NAME_REQUIRED:     ['err-join-name', 'Veuillez saisir votre nom.'],
        CODE_REQUIRED:     ['err-join-code', 'Veuillez saisir un code de session.'],
        SESSION_NOT_FOUND: ['err-join-code', 'Session introuvable. Vérifiez le code ou attendez que le facilitateur lance la session.'],
        SESSION_FULL:      ['err-join-code', 'Session complète (8 participants max).'],
        PEER_ERROR:        ['err-join-code', 'Erreur réseau. Vérifiez votre connexion internet.'],
      };
      const [elId, msg] = messages[result.error] ?? ['err-join-code', 'Erreur inconnue.'];
      showError(elId, msg);
    }
  });

document.getElementById('join-code')
  ?.addEventListener('input', function () { this.value = this.value.toUpperCase(); });

/* ══════════════════════════════════════════════════
   CONTRÔLES FACILITATEUR — synchrones (CDC §3.1)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-update-item')
  ?.addEventListener('click', () => {
    updateItem(document.getElementById('item-input')?.value.trim() ?? '');
  });

document.getElementById('btn-launch')
  ?.addEventListener('click', () => {
    launchVote(document.getElementById('item-input')?.value.trim() ?? '');
    showNotif('Vote lancé !');
  });

document.getElementById('btn-reveal')
  ?.addEventListener('click', () => revealVotes());

document.getElementById('btn-newround')
  ?.addEventListener('click', () => newRound());

document.getElementById('btn-close-session')
  ?.addEventListener('click', () => showModal('modal-close'));

/* ══════════════════════════════════════════════════
   MODAL CLÔTURE
   ══════════════════════════════════════════════════ */

document.getElementById('btn-modal-cancel')
  ?.addEventListener('click', () => hideModal('modal-close'));

document.getElementById('btn-modal-confirm')
  ?.addEventListener('click', () => {
    hideModal('modal-close');
    closeSession();
    hideHeader();
    showScreen('home');
    showNotif('Session clôturée.');
  });

document.getElementById('modal-close')
  ?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-close') hideModal('modal-close');
  });

/* ══════════════════════════════════════════════════
   CONTRÔLES PARTICIPANT — synchrones (CDC §3.2)
   ══════════════════════════════════════════════════ */

document.getElementById('cards-grid')
  ?.addEventListener('click', (e) => {
    const card = e.target.closest('.vote-card');
    if (!card || card.classList.contains('disabled')) return;
    const value = parseInt(card.dataset.value, 10);
    if (isNaN(value)) return;
    if (castVote(value)) { onRender(); showNotif(`Vote enregistré : ${value}`); }
  });

document.getElementById('btn-leave')
  ?.addEventListener('click', () => { leaveSession(); hideHeader(); showScreen('home'); });

/* ══════════════════════════════════════════════════
   LIEN D'INVITATION
   ══════════════════════════════════════════════════ */

document.getElementById('btn-copy-link')
  ?.addEventListener('click', () => {
    const val = document.getElementById('session-link-input')?.value;
    if (val) copyToClipboard(val);
  });

/* ══════════════════════════════════════════════════
   INITIALISATION
   ══════════════════════════════════════════════════ */

async function init() {
  /* Pré-remplir le code depuis l'URL (lien d'invitation) */
  const urlCode = getUrlSessionId();
  if (urlCode) {
    const inp = document.getElementById('join-code');
    if (inp) inp.value = urlCode;
  }

  /* Restaurer la session après rechargement de page (F5) */
  const me = loadMe();
  if (!me) return;

  const restored = await restoreSession(me, onRoomReady, onRender);
  if (!restored) clearMe();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
