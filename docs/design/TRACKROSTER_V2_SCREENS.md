# TrackRoster V2 — approved screen inventory

Extracted from `TrackRoster-apercu.html`, the approved V2 walkthrough, so the
specification survives outside a 3.4 MB file in someone’s Downloads folder.

Two things to know before using it.

**It is a screenshot tour, not portable markup.** The file holds 38 embedded WebP
images and a JavaScript array of captions; there is no application HTML or CSS in
it to port. The images are the only record of the visual design, and the text
below is the only record of the intent. The colour and typography tokens for V2
came with the implementation brief, not with this file.

**Its example data is illustrative.** The counts and names in the screenshots are
not production data and must never be reproduced as fixtures.

Every `path` below is the route the walkthrough assigns to a screen. Several V2
screens share one route because they are states of it rather than separate pages.

## Console d'administration

22 screens · Desktop

### Connexion

`a00-login` · route `/login` · desk

Chaque membre de l'équipe a son accès personnel. À la première connexion, il remplace
son mot de passe provisoire par le sien ; un code de vérification par e-mail peut être
exigé en plus.

- Mot de passe provisoire obligatoirement changé
- Blocage après 5 tentatives
- Code par e-mail en option

### Vue d’ensemble

`a01-dashboard` · route `/admin` · desk

Le tableau de bord de la direction : activité des 14 derniers jours, contacts utiles,
rendez-vous, collisions évitées, réalisation des listes par prospecteur et couverture de
chaque secteur.

- Filtre par entreprise
- Alertes : relances en retard, prospecteurs inactifs, réponses à lire
- Qualité des données : téléphones, e-mails, positions

### En direct

`a02-direct` · route `/admin/direct` · desk

Qui prospecte en ce moment, dans quel mode, avec quel avancement. Les contacts en cours
sont verrouillés ; l'administrateur peut libérer un établissement ou terminer une
session.

- Actualisation automatique toutes les 30 secondes
- Tournées terrain sur la carte
- Fil des dernières actions avec comptes rendus

### La base de prospects

`a03-prospects` · route `/admin/prospects` · desk

Les 14 649 établissements, visibles uniquement par l'administration. Recherche et
filtres combinables : secteur, région, département, statut, attribution, entreprise
ayant déjà contacté, coordonnées disponibles.

- Sélection multiple ou tout un filtre
- Export CSV compatible Excel
- Ajout manuel d’un établissement

### Attribuer des établissements

`a04-assign` · route `/admin/prospects` · desk

Constituer le portefeuille d'un prospecteur : les établissements attribués passent en
tête de ses listes et deviennent invisibles pour les autres. Plusieurs prospecteurs
cochés = répartition équilibrée.

- Durée d’attribution au choix
- Dérogation aux délais, avec motif obligatoire
- Chaque décision est inscrite au journal

### Vue carte

`a05-prospects-map` · route `/admin/prospects` · desk

Les établissements filtrés sur la carte : gris = jamais contacté, bleu = déjà contacté,
vert = attribué. Un clic ouvre la fiche.

- Fonds de carte OpenStreetMap dans l’application
- Précision de position indiquée sur chaque fiche

### Fiche établissement

`a06-fiche` · route `/admin/prospects/…` · desk

Tout est modifiable par l'administration. À droite, le moteur anti-collision répond pour
chaque entreprise : qui peut contacter cet établissement maintenant, et jusqu'à quand il
est bloqué.

- Statut, priorité, « ne plus contacter »
- Attribution, réservation en cours, relances
- Géolocalisation de l’adresse en un clic

### Historique complet

`a07-fiche-historique` · route `/admin/prospects/…` · desk

Chaque appel, visite et e-mail, avec interlocuteur, langues, besoins et compte rendu.
Les réponses des prospecteurs aux demandes de complément s'ajoutent automatiquement à la
fiche.

- Historique immuable : une action enregistrée ne se modifie plus
- E-mails envoyés consultables
- Événements : attributions, blocages, modifications

### Script et e-mail propres à l’établissement

`a08-fiche-script` · route `/admin/prospects/…` · desk

Pour un établissement stratégique, l'administration rédige un script ou un e-mail
spécifique. Les variables restent personnalisées : l'aperçu montre le texte exact qu'un
prospecteur de chaque entreprise verra.

- Aperçu entreprise par entreprise
- Retour au modèle standard en un clic

### Demander un complément

`a09-complement` · route `/admin/prospects/…` · desk

Une question au prospecteur, liée à son action. Il la reçoit dans ses messages ; sa
réponse enrichit l'historique de l'établissement.

- Depuis une fiche ou depuis la page Activité
- Conversation suivie jusqu’à clôture

### Équipe

`a10-equipe` · route `/admin/equipe` · desk

Tous les comptes, rattachés à l'entreprise pour laquelle chacun prospecte : modes
autorisés, territoire, portefeuille, activité de la semaine, dernière connexion.

- Filtre par entreprise
- État : actif, en session, accès à activer, désactivé

### Créer un accès

`a11-nouveau-membre` · route `/admin/equipe` · desk

Nom, e-mail, entreprise, modes de prospection, départements, secteurs, historique
visible ou non, rythme et point de départ pour le terrain.

- Territoire limité à certains départements
- Rythme ajusté pour un mi-temps ou un débutant

### Identifiants à transmettre

`a12-identifiants` · route `/admin/equipe` · desk

Le mot de passe provisoire est généré et affiché une seule fois, avec un message prêt à
copier contenant l'adresse du site et l'identifiant.

- Réinitialisation et déconnexion à distance
- Désactivation : établissements libérés, historique conservé

### Activité

`a13-activite` · route `/admin/activite` · desk

Toutes les actions de toutes les équipes, filtrables par prospecteur, entreprise,
résultat, canal, secteur et période. Les comptes rendus incomplets sont signalés.

- Demande de complément en un clic
- Export CSV des actions

### Messages

`a14-messages` · route `/admin/messages` · desk

Les échanges avec les prospecteurs : demandes de complément, signalements de fiches
erronées. Réponses à lire, en attente, clôturées.

- Lien direct vers la fiche concernée
- Rappel de l’action d’origine dans la conversation

### Scripts et e-mails

`a15-scripts` · route `/admin/scripts` · desk

Les modèles d'appel, de visite et d'e-mail. Le plus précis l'emporte : un modèle propre
à une entreprise et à un secteur passe avant le modèle général.

- Variables insérées d’un clic
- Argumentaires par secteur modifiables

### Aperçu d’un modèle

`a16-scripts-apercu` · route `/admin/scripts` · desk

Le texte réel, calculé pour un établissement de la base, un prospecteur et une
entreprise : prénom, nom, entreprise, service à solliciter, besoin pressenti.

- Salutation adaptée à l’heure
- Lignes vides retirées automatiquement

### Entreprises

`a17-entreprises` · route `/admin/entreprises` · desk

GFTIJ, InterTrad, OFTI, SDI et AFTIJ : nom complet, standard, e-mail de réponse, site,
devise, argumentaire et secteurs prospectés. Ces informations alimentent scripts,
e-mails et signatures.

- Couleur de chaque entreprise dans toute l’interface
- Activation ou désactivation

### Règles anti-collision

`a18-regles` · route `/admin/parametres` · desk

La grille des délais entre deux contacts d'un même établissement, entreprise par
entreprise : 30 jours au sein d'une même entreprise, 7 jours entre entreprises par
défaut, modifiables case par case.

- Délais spécifiques après « sans réponse » et après un refus
- Relances protégées, verrou pendant un appel
- Distance minimale entre deux équipes terrain

### Objectifs et visibilité

`a19-regles-visibilite` · route `/admin/parametres` · desk

Les objectifs de session (temps par appel, durée de visite, vitesses, rayons de tournée)
et ce que les prospecteurs voient ou peuvent faire.

- Historique personnel visible ou non
- Choix du secteur et du département
- Modification de l’e-mail avant envoi

### Import de données

`a20-import` · route `/admin/import` · desk

Ajout d'établissements depuis Excel ou CSV : colonnes reconnues automatiquement,
téléphones et codes postaux normalisés, doublons détectés par identifiant, téléphone ou
nom et code postal.

- Analyse sans importer, puis confirmation
- Rapport : créés, doublons, rejetés, anomalies

### Journal d’audit

`a21-journal` · route `/admin/journal` · desk

Connexions, échecs de connexion, modifications de fiches, attributions, dérogations,
exports et réglages : tout ce qui est sensible est tracé.

- Filtre par type d’événement
- Non modifiable depuis l’application

## Application des prospecteurs

15 screens · Mobile first

### Préparer sa session

`m00-preparer` · route `/app` · phone

Le matin, le prospecteur choisit son mode. Les relances arrivées à échéance sont
annoncées : elles seront placées en tête de sa liste.

- Téléphone, terrain ou e-mail selon ses droits
- Aucun accès à la base complète

### Session terrain

`m01-preparer-terrain` · route `/app` · phone

Temps disponible, transports en commun ou véhicule, point de départ : adresse
enregistrée ou position actuelle du téléphone.

- Rayon de 20 km en transports, 60 km en véhicule
- Secteur et département au choix

### La tournée du jour

`m02-tournee` · route `/app` · phone

Une liste réservée pour lui seul : nombre d'arrêts, kilomètres, durée estimée, et les
établissements écartés pour ne pas croiser une autre équipe.

- Bouton « Prochain » toujours visible
- Itinéraire Google Maps de la tournée
- Progression dessinée comme la grille du logo

### Carte de la tournée

`m03-carte` · route `/app` · phone

L'ordre de passage est optimisé depuis le point de départ ; chaque arrêt numéroté ouvre
la fiche.

- Fonds de carte OpenStreetMap dans l’application

### Horaires de passage

`m04-liste` · route `/app` · phone

Pour chaque arrêt : temps et distance de trajet, heure de passage prévue, relance ou
attribution signalée.

- Filtres « à traiter » et « traités »

### Fiche et feu vert

`m05-fiche` · route `/app` · phone

Avant tout contact, le moteur confirme que personne d'autre n'est sur l'établissement. «
Je suis sur place » ou « Appeler » verrouille le contact le temps de l'échange.

- Coordonnées, service à solliciter, besoin pressenti
- Ce que l’équipe sait déjà : interlocuteur, langues

### Script personnalisé

`m06-script` · route `/app` · phone

Le script d'appel ou de visite, rédigé à son nom, au nom de son entreprise et adapté au
type d'établissement.

- Objections fréquentes et questions de qualification
- Copie en un geste

### E-mail personnalisé

`m07-email` · route `/app` · phone

L'e-mail de prise de contact ou « suite à notre appel / mon passage », déjà rédigé pour
cet établissement, son entreprise et sa signature.

- Modifiable avant l’envoi si l’administration l’autorise
- Envoi automatique ou depuis sa propre messagerie

### Enregistrer le résultat

`m08-resultat` · route `/app` · phone

Contact établi, intéressé, rendez-vous, à rappeler, sans réponse, refus… puis
l'interlocuteur, sa fonction, ses coordonnées directes, les langues et besoins.

- Tout ce qui est saisi enrichit la fiche
- Interlocuteur obligatoire quand quelqu’un a été joint

### Compte rendu et suite

`m09-resultat-fin` · route `/app` · phone

Le compte rendu peut être dicté à la voix. Pour un rendez-vous ou une relance, la date
réserve l'établissement à son auteur jusque-là.

- Raccourcis « demain », « dans 3 jours »…
- Historique immuable après enregistrement

### Mes relances

`m10-relances` · route `/app/relances` · phone

Les relances et rendez-vous programmés ; celles en retard apparaissent en rouge.

- Placées automatiquement en tête de la liste du jour

### Mon historique

`m11-historique` · route `/app/historique` · phone

Uniquement ses propres contacts, sur la période autorisée par l'administration, avec ses
statistiques.

- Désactivable par l’administration, globalement ou par personne

### Messages

`m12-messages` · route `/app/messages` · phone

Les demandes de l'administration et ses signalements. Sa réponse est ajoutée à la fiche
de l'établissement.

- Pastille de messages non lus dans la navigation

### Aussi sur ordinateur

`p00-desktop-journee` · route `/app` · desk

Une session téléphone sur ordinateur : les relances du jour et le portefeuille attribué
passent en premier.

- Même application, adaptée à l’écran

### La fiche en panneau latéral

`p01-desktop-fiche` · route `/app` · desk

Sur ordinateur, la fiche s'ouvre à droite de la liste : on enchaîne les appels sans
quitter sa liste.

- Appel direct depuis le navigateur ou le téléphone
