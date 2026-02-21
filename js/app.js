/**
 * app.js — Point d'entrée de l'application (module ES6)
 *
 * Rôle : orchestrer le démarrage, lier les événements DOM aux modules métier,
 * et injecter les callbacks de rendu dans session.js / channel.js.
 *
 * Aucune logique métier ici — uniquement du câblage.
 */

'use strict';

import { ROLE, ERR, MSG }                           from './config.js';
import { loadSession, loadMe, clearMe }             from './storage.js';
import { openChannel, broadcast }                   from './channel.js';
import {
  state,
  createSession, joinSession, leaveSession, closeSession,
  updateItem, launchVote, revealVotes, newRound, castVote,
  getUrlSessionId, setUrlSessionId, buildInviteUrl,
} from './session.js';
import { renderRoom }                               from './render.js';
import {
  showScreen, showNotif, showModal, hideModal,
  showError, clearErrors, renderHeader, hideHeader,
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
   INJECTION DES CALLBACKS RÉSEAU
   ══════════════════════════════════════════════════ */

state.onParticipantJoin  = (name) => showNotif(`${name} a rejoint la session`);
state.onParticipantLeave = ()     => showNotif('Un participant a quitté la session');

state.onSessionClosed = () => {
  hideHeader();
  showScreen('home');
  showNotif('Le facilitateur a clôturé la session.');
};

state.onError = (code) => {
  if (code === ERR.SESSION_FULL) {
    showError('err-join-code', 'Session complète (8 participants max).');
  }
};

/* ══════════════════════════════════════════════════
   CRÉER UNE SESSION (CDC §5.1)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-create-session')
  ?.addEventListener('click', () => {
    const name = document.getElementById('create-name')?.value.trim() ?? '';
    const item = document.getElementById('create-item')?.value.trim() ?? '';
    clearErrors('err-create-name');

    if (!name) {
      showError('err-create-name', 'Veuillez saisir votre nom.');
      return;
    }
    const ok = createSession(name, item, onRoomReady, onRender);
    if (!ok) showError('err-create-name', 'Erreur lors de la création.');
  });

/* ══════════════════════════════════════════════════
   REJOINDRE UNE SESSION (CDC §5.2)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-join-session')
  ?.addEventListener('click', () => {
    const code = document.getElementById('join-code')?.value.trim().toUpperCase() ?? '';
    const name = document.getElementById('join-name')?.value.trim() ?? '';
    clearErrors('err-join-code', 'err-join-name');

    const result = joinSession(code, name, onRoomReady, onRender);

    if (!result.success) {
      const messages = {
        NAME_REQUIRED:     ['err-join-name', 'Veuillez saisir votre nom.'],
        CODE_REQUIRED:     ['err-join-code', 'Veuillez saisir un code de session.'],
        SESSION_NOT_FOUND: ['err-join-code', 'Session introuvable. Vérifiez le code.'],
        SESSION_FULL:      ['err-join-code', 'Session complète (8 participants max).'],
      };
      const [elId, msg] = messages[result.error] ?? ['err-join-code', 'Erreur inconnue.'];
      showError(elId, msg);
    }
  });

document.getElementById('join-code')
  ?.addEventListener('input', function () { this.value = this.value.toUpperCase(); });

/* ══════════════════════════════════════════════════
   CONTRÔLES FACILITATEUR (CDC §3.1)
   ══════════════════════════════════════════════════ */

document.getElementById('btn-update-item')
  ?.addEventListener('click', () => {
    updateItem(document.getElementById('item-input')?.value.trim() ?? '');
    onRender();
  });

document.getElementById('btn-launch')
  ?.addEventListener('click', () => {
    launchVote(document.getElementById('item-input')?.value.trim() ?? '');
    showNotif('Vote lancé !');
    onRender();
  });

document.getElementById('btn-reveal')
  ?.addEventListener('click', () => { revealVotes(); onRender(); });

document.getElementById('btn-newround')
  ?.addEventListener('click', () => { newRound(); onRender(); });

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
   CONTRÔLES PARTICIPANT (CDC §3.2)
   ══════════════════════════════════════════════════ */

/* Délégation sur la grille (évite de rebinder à chaque rendu) */
document.getElementById('cards-grid')
  ?.addEventListener('click', (e) => {
    const card = e.target.closest('.vote-card');
    if (!card || card.classList.contains('disabled')) return;
    const value = parseInt(card.dataset.value, 10);
    if (isNaN(value)) return;
    if (castVote(value)) { showNotif(`Vote enregistré : ${value}`); onRender(); }
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

function init() {
  /* Pré-remplir le code depuis l'URL */
  const urlCode = getUrlSessionId();
  if (urlCode && loadSession(urlCode)) {
    const inp = document.getElementById('join-code');
    if (inp) inp.value = urlCode;
  }

  /* Restaurer la session après rechargement (sessionStorage) */
  const me = loadMe();
  if (!me) return;

  const sess = loadSession(me.sessionId);
  if (!sess) { clearMe(); return; }

  state.myId      = me.myId;
  state.myName    = me.myName;
  state.myRole    = me.myRole;
  state.sessionId = me.sessionId;
  state.session   = sess;

  openChannel(me.sessionId, state, onRender);
  broadcast(MSG.REQUEST_STATE);
  setUrlSessionId(me.sessionId);
  onRoomReady();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
