/* firebase.js — Helper minimal pour Firestore + Auth
 * Usage:
 *  - Set window.FIREBASE_CONFIG = { apiKey, authDomain, projectId, ... } in index.html before loading app.js
 *  - Then session.js will detect fb.isEnabled() and use Firestore for persistence and realtime listeners
 *
 * Notes:
 *  - Do NOT commit production API keys/secrets. Client Firebase config is public by design; secure rules control access.
 *  - This is a minimal example, intended to be adapted for production: add stronger validation, error handling and cleanup.
 */

/* eslint-disable no-console */

export let _enabled = false;
export let _app = null;
export let _auth = null;
export let _db = null;

// lazy init to avoid errors if FIREBASE_CONFIG is absent
export function isEnabled() {
    return Boolean(window.FIREBASE_CONFIG);
}

export async function ensureInit() {
    if (!isEnabled()) return false;
    if (_app) return true;

    // Import modular Firebase SDK from CDN (works in module contexts)
    const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator }, { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, onSnapshot, runTransaction, serverTimestamp, query, getDocs }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'),
    ]);

    _app = initializeApp(window.FIREBASE_CONFIG);
    _auth = getAuth(_app);
    _db = getFirestore(_app);

    // If running with local emulators, connect to them when requested
    if (window.FIREBASE_EMULATOR) {
        try {
            const authEmuUrl = window.FIREBASE_EMULATOR_AUTH_URL || 'http://localhost:9099';
            const fsHost = window.FIREBASE_EMULATOR_FIRESTORE_HOST || 'localhost';
            const fsPort = window.FIREBASE_EMULATOR_FIRESTORE_PORT || 8080;
            if (typeof connectAuthEmulator === 'function') connectAuthEmulator(_auth, authEmuUrl);
            if (typeof connectFirestoreEmulator === 'function') connectFirestoreEmulator(_db, fsHost, fsPort);
            console.log('[firebase] connected to emulators');
        } catch (e) {
            console.warn('[firebase] connect emulators failed', e);
        }
    }

    _enabled = true;

    // Sign in anonymously for quick start
    try {
        await signInAnonymously(_auth);
    } catch (e) {
        // if already signed-in or blocked, ignore here — callers should handle errors
        console.warn('[firebase] anonymous sign-in failed', e);
    }

    return true;
}

export function getAuthUid() {
    return _auth?.currentUser?.uid ?? null;
}

// Create a session document and a participant subdoc for facilitator
export async function createSessionFirestore(sessionId, facilitatorUid, facilitatorName, item = '') {
    await ensureInit();
    const sessionRef = doc(_db, 'sessions', sessionId);
    await setDoc(sessionRef, {
        id: sessionId,
        facilitatorUid,
        facilitatorName,
        status: 'waiting',
        currentItem: item || '',
        createdAt: serverTimestamp(),
    });

    const pRef = doc(sessionRef, 'participants', facilitatorUid);
    await setDoc(pRef, {
        id: facilitatorUid,
        name: facilitatorName,
        vote: null,
        isFacilitator: true,
        joinedAt: serverTimestamp(),
    });

    return sessionRef;
}

// Add participant within a transaction to allow counting and max participants checks
export async function addParticipant(sessionId, uid, name, maxParticipants = 8) {
    await ensureInit();
    const sessionRef = doc(_db, 'sessions', sessionId);

    return runTransaction(_db, async (tx) => {
        const s = await tx.get(sessionRef);
        if (!s.exists()) throw { code: 'SESSION_NOT_FOUND' };

        // count participants by reading subcollection snapshot (note: this is simple but not the most efficient for large rooms)
        const partsSnap = await getDocs(collection(sessionRef, 'participants'));
        const nonFac = partsSnap.docs.filter(d => !(d.data().isFacilitator));
        if (nonFac.length >= maxParticipants) throw { code: 'SESSION_FULL' };

        const pRef = doc(sessionRef, 'participants', uid);
        tx.set(pRef, { id: uid, name, vote: null, isFacilitator: false, joinedAt: serverTimestamp() });
    });
}

// Listen for session doc + participants subcollection and call onUpdate with a combined session object
export async function listenSession(sessionId, onUpdate, onError) {
    await ensureInit();
    const sessionRef = doc(_db, 'sessions', sessionId);

    let lastSession = null;
    let lastParticipants = [];
    
    const unsubSession = onSnapshot(sessionRef, (snap) => {
        if (!snap.exists()) {
            onError && onError({ code: 'SESSION_NOT_FOUND' });
            return;
        }
        lastSession = snap.data();
        // combine and call
        onUpdate && onUpdate(combine(lastSession, lastParticipants));
    }, (err) => onError && onError(err));

    const partsCol = collection(sessionRef, 'participants');
    const unsubParts = onSnapshot(partsCol, (qSnap) => {
        lastParticipants = qSnap.docs.map(d => d.data());
        onUpdate && onUpdate(combine(lastSession, lastParticipants));
    }, (err) => onError && onError(err));

    function combine(sessionDoc, participantsArr) {
        if (!sessionDoc) return null;
        return {
            id: sessionDoc.id,
            facilitatorId: sessionDoc.facilitatorUid,
            facilitatorName: sessionDoc.facilitatorName,
            status: sessionDoc.status,
            currentItem: sessionDoc.currentItem || '',
            participants: participantsArr || [],
            createdAt: sessionDoc.createdAt ? sessionDoc.createdAt.seconds * 1000 : Date.now(),
        };
    }

    return function unsubscribe() {
        try { unsubSession(); } catch (e) {}
        try { unsubParts(); } catch (e) {}
    };
}

export async function castVoteFirestore(sessionId, uid, vote) {
    await ensureInit();
    const pRef = doc(_db, 'sessions', sessionId, 'participants', uid);
    await updateDoc(pRef, { vote });
}

export async function updateSessionFirestore(sessionId, patch = {}) {
    await ensureInit();
    const sessionRef = doc(_db, 'sessions', sessionId);
    await updateDoc(sessionRef, { ...patch, updatedAt: serverTimestamp() });
}

export async function removeParticipant(sessionId, uid) {
    await ensureInit();
    const pRef = doc(_db, 'sessions', sessionId, 'participants', uid);
    try { await deleteDoc(pRef); } catch (e) { console.warn('[firebase] removeParticipant', e); }
}

export async function closeSessionFirestore(sessionId) {
    await ensureInit();
    const sessionRef = doc(_db, 'sessions', sessionId);
    // Best effort: mark closedAt; deletion of subcollections requires batch deletes or Cloud Function
    await updateDoc(sessionRef, { closedAt: serverTimestamp() }).catch(async (e) => {
        // If update fails because doc doesn't exist, ignore
        try { await deleteDoc(sessionRef); } catch (err) { console.warn('[firebase] closeSession', err); }
    });
}

// Utility: simple helper to surface errors with code mapping
export function mapError(e) {
    if (!e) return { code: 'UNKNOWN', message: 'Erreur inconnue' };
    if (e.code) return e;
    if (e.message) return { code: 'ERROR', message: e.message };
    return { code: 'ERROR' };
}
