# Commercialisation QR Resto

## Installation locale conseillee

1. Installer l'application sur un ordinateur serveur dans le restaurant.
2. Fixer une adresse IP locale au serveur, par exemple `192.168.1.50`.
3. Configurer `QR_BASE_URL` avec cette adresse.
4. Imprimer les QR codes de table depuis l'onglet Admin.
5. Garder l'ordinateur serveur allume pendant le service.

Exemple:

```text
QR_BASE_URL=http://192.168.1.50:5173
```

Les QR codes seront:

```text
http://192.168.1.50:5173/t/1
http://192.168.1.50:5173/t/2
http://192.168.1.50:5173/t/3
```

## Securite obligatoire

Chaque installation doit avoir un `JWT_SECRET` unique. Cette cle signe les sessions des utilisateurs. Si elle est faible ou partagee, une personne peut fabriquer un faux acces admin.

## Roles

- `superadmin`: gere les restaurants, sauvegardes et restauration.
- `admin`: gere le restaurant, le menu, les stocks, utilisateurs et parametres.
- `caisse`: gere les paiements, statistiques et exports.
- `cuisine`: traite les commandes.
- `serveur`: suit les commandes et marque les plats servis.

## Sauvegardes

Les sauvegardes automatiques sont activees par `BACKUP_INTERVAL_HOURS`. Le Super Admin peut aussi:

- creer une sauvegarde manuelle;
- lister les sauvegardes;
- exporter la base;
- restaurer une sauvegarde.

En mode MySQL (`DB_CLIENT=mysql`), l'export et la sauvegarde utilisent `mysqldump` et produisent un fichier `.sql`.

Restauration MySQL recommandee hors service:

```text
mysql -u root -P 3306 qr_resto < backend/backups/nom-du-backup.sql
```

## MySQL

Le schema cible est disponible dans `backend/schema.mysql.sql`.

Commandes disponibles:

```text
cd backend
npm run mysql:init
npm run mysql:migrate
npm run mysql:backup
```

Ordre conseille:

1. Creer l'utilisateur MySQL et configurer `.env`.
2. Lancer `npm run mysql:init` pour creer les tables.
3. Lancer `npm run mysql:migrate` pour copier les donnees SQLite existantes vers MySQL.
4. Lancer `npm run mysql:backup` pour verifier que les sauvegardes MySQL fonctionnent.

La prochaine etape technique est la bascule runtime des routes vers une couche MySQL asynchrone.
