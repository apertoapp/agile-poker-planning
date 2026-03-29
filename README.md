# 🎯 Agile Poker Planning - youpi

[![Planning Poker](https://img.shields.io/badge/Planning_Poker-8%20joueurs-blue?style=for-the-badge&logo=github)](https://apertoapp.github.io/agile-poker-planning/)
[![100% Statique](https://img.shields.io/badge/100%25_Statique-NoServer-green?style=for-the-badge&logo=github)](https://apertoapp.github.io/agile-poker-planning/)
[![Temps Réel](https://img.shields.io/badge/Temps_R%C3%A9el-BroadcastChannel-orange?style=for-the-badge&logo=electron)](https://apertoapp.github.io/agile-poker-planning/)

> **Application Planning Poker autonome en temps réel pour 8 participants maximum et 1 facilitateur.**

## 📋 Description

Cette application permet aux équipes agiles de réaliser des estimations de tâches en utilisant la technique du Planning Poker. Elle fonctionne entièrement côté client, sans nécessiter de serveur backend.

## ✨ Fonctionnalités

### Pour les Participants
- 🎴 Sélection d'une carte parmi 7 valeurs (0, 1, 2, 3, 5, 8, 13)
- ⏱️ Visualisation du timer en temps réel
- ✅ Validation du vote avec confirmation
- 🔒 Verrouillage automatique après le vote

### Pour le Facilitateur
- ⚙️ Configuration du timer (10-600 secondes)
- ▶️ Démarrage de session de vote
- 📊 Suivi en temps réel du nombre de participants ayant voté
- 🎯 Affichage des résultats à la fin du timer
- 🔄 Réinitialisation pour une nouvelle session

## 🚀 Accédez à l'appliction 
- **L'application est hébergée sur GitHub Page**
- **URL** : [https://apertoapp.github.io/agile-poker-planning](https://apertoapp.github.io/agile-poker-planning)

## 🎮 Utilisation

### Démarrage d'une session

1. **Le facilitateur** :
    - Ouvre l'application et clique sur "Je suis le facilitateur"
    - Configure la durée du timer (par défaut 60 secondes)
    - Clique sur "Démarrer le vote"

2. **Les participants** :
    - Ouvrent l'application et cliquent sur "Je suis un participant"
    - Choisissent une carte en cliquant dessus
    - Cliquent sur "Valider mon vote"

3. **Fin de la session** :
    - Le timer se déclenche automatiquement
    - Les résultats s'affichent automatiquement à la fin du timer
    - Le facilitateur peut réinitialiser pour une nouvelle session

### Synchronisation multi-utilisateurs

L'application utilise `localStorage` pour synchroniser les votes entre différents onglets/fenêtres du même navigateur. Pour une vraie session multi-utilisateurs sur différents appareils, vous devriez :

- Soit ouvrir tous les participants sur le même appareil (différents onglets)
- Soit implémenter une solution backend avec WebSockets ou Firebase

## 🔧 Technologies utilisées

- **HTML5** : Structure des pages
- **CSS3** : Design responsive et animations
- **JavaScript Vanilla** : Logique métier (aucune dépendance)
- **localStorage** : Stockage temporaire des votes

## ⚙️ Configuration

### Modifier les valeurs des cartes

Dans `script.js`, modifiez la constante :

```javascript
const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13'];
```

Exemples :
- **Fibonacci complet** : `['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?']`
- **T-Shirt Sizing** : `['XS', 'S', 'M', 'L', 'XL', 'XXL']`
- **Heures** : `['1h', '2h', '4h', '8h', '16h', '24h']`

### Modifier le nombre maximum de participants

Par défaut, l'application affiche "X / 8". Pour changer ce nombre, modifiez dans les fichiers HTML :

```html
<span id="voteCount">0</span> / 8
```

## 🎨 Personnalisation

### Couleurs

Les couleurs principales sont définies dans `style.css` via des gradients :

```css
/* Participant */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Facilitateur */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

### Son de fin

Le son joué à la fin du timer est encodé en base64 dans `script.js`. Vous pouvez le remplacer par votre propre son :

```javascript
function playEndSound() {
    const audio = new Audio('chemin/vers/votre/son.mp3');
    audio.play();
}
```

## 📱 Compatibilité

- ✅ Chrome (dernière version)
- ✅ Firefox (dernière version)
- ✅ Safari (dernière version)
- ✅ Edge (dernière version)
- ✅ Mobile (iOS Safari, Chrome Android)

## ⚠️ Limitations

- Fonctionne uniquement avec `localStorage` (même navigateur/appareil)
- Pas de persistance des données après fermeture du navigateur
- Maximum 8 participants recommandé
- Pas d'authentification ni de sécurité

## 🔮 Améliorations futures

- [ ] Backend avec WebSockets pour vraie synchronisation multi-utilisateurs
- [ ] Mode anonyme (sans affichage des IDs)
- [ ] Export des résultats en CSV
- [ ] Historique des sessions
- [ ] Choix de différents jeux de cartes
- [ ] Mode sombre
- [ ] Statistiques (moyenne, médiane)

## 📄 Licence

Ce projet est sous licence MIT. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des nouvelles fonctionnalités
- Soumettre des pull requests

## 📞 Contact & Support

**Auteur** : **Aperto App**
**Usage** : 100% gratuit pour équipes/formation

```
❓ Question ? → Issues GitHub
✨ Idée ? → Pull Request
⭐ Like ? → Star le repo !
```

---

**Fait avec ❤️ pour les équipes Agiles**