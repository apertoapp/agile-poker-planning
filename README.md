# 🎯 Agile Poker Planning

**Estimez mieux. Décidez plus vite. Ensemble.**

[![Planning Poker](https://img.shields.io/badge/Planning_Poker-8%20joueurs-blue?style=for-the-badge&logo=github)](https://apertoapp.github.io/agile-poker-planning/)
[![Gratuit](https://img.shields.io/badge/100%25_Gratuit-green?style=for-the-badge)]()
[![Accéder à l'application](https://img.shields.io/badge/▶_Lancer_l'application-orange?style=for-the-badge)](https://apertoapp.github.io/agile-poker-planning/)


> **Application Planning Poker autonome en temps réel pour 8 participants maximum et 1 facilitateur.**

## 📋 À quoi ça sert ?

Le Planning Poker est la technique d'estimation la plus utilisée dans les équipes Agile et Scrum. Mais organiser une session en remote avec des outils dispersés (post-its, tableurs, votes à la main en visio) fait perdre du temps et génère des biais.

**Agile Poker Planning centralise tout** : chaque participant vote sur son appareil, les résultats s'affichent au même moment pour tout le monde, depuis n'importe quel navigateur et n'importe quel endroit dans le monde.

---

## ✨ Ce que vous pouvez faire

### En tant que facilitateur
- ⚙️ Créer une session en 5 secondes, sans compte
- ⚙️ Définir l'item à estimer (User Story, tâche, bug…)
- ✅ Partager un lien d'invitation en un clic
- ▶️ Lancer le vote quand tout le monde est prêt
- 📊 Révéler toutes les cartes simultanément
- 🔄 Relancer un tour si les écarts sont trop importants
- 🎯 Clôturer la session en fin de réunion

### En tant que participant
- ⚙️ Rejoindre via un lien ou un code à 4 caractères
- 🎴 Voter avec la suite Fibonacci : **0 — 1 — 2 — 3 — 5 — 8 — 13**
- 🔄 Modifier son vote tant que les cartes ne sont pas révélées
- 📊 Voir les résultats en temps réel dès la révélation

---

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