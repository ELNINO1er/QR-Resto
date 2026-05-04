export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'QR Resto API',
    version: '1.0.0',
    description: 'API pour menu QR, commandes, cuisine, service, administration, restaurants et maintenance.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': { get: { summary: 'Etat API', responses: { 200: { description: 'OK' } } } },
    '/auth/login': { post: { summary: 'Connexion utilisateur', responses: { 200: { description: 'Token JWT' } } } },
    '/auth/me': { get: { summary: 'Utilisateur connecte', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profil' } } } },
    '/auth/password': { patch: { summary: 'Changer mot de passe', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } } },
    '/menu': {
      get: { summary: 'Menu public ou menu complet admin avec ?all=1', responses: { 200: { description: 'Liste des plats' } } },
      post: { summary: 'Ajouter un plat', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Plat cree' } } },
    },
    '/menu/{id}': {
      patch: { summary: 'Modifier un plat', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Plat modifie' } } },
      delete: { summary: 'Supprimer un plat', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Plat supprime' } } },
    },
    '/orders': {
      get: { summary: 'Lister les commandes', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste commandes' } } },
      post: { summary: 'Creer une commande client', responses: { 201: { description: 'Commande creee' } } },
    },
    '/orders/stats': { get: { summary: 'Statistiques', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Stats' } } } },
    '/orders/reports': { get: { summary: 'Rapports ventes', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Rapports' } } } },
    '/orders/export.csv': { get: { summary: 'Export CSV commandes', security: [{ bearerAuth: [] }], responses: { 200: { description: 'CSV' } } } },
    '/orders/{id}': { patch: { summary: 'Changer statut commande', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Commande modifiee' } } } },
    '/orders/{id}/payment': { patch: { summary: 'Mettre a jour paiement', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Paiement modifie' } } } },
    '/orders/{id}/public': { get: { summary: 'Suivi public commande par table', responses: { 200: { description: 'Commande publique' } } } },
    '/settings/public': { get: { summary: 'Parametres publics', responses: { 200: { description: 'Parametres publics' } } } },
    '/settings/network': { get: { summary: 'Information reseau QR', responses: { 200: { description: 'Reseau' } } } },
    '/settings': {
      get: { summary: 'Parametres admin', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Parametres' } } },
      patch: { summary: 'Modifier parametres', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Parametres modifies' } } },
    },
    '/users': {
      get: { summary: 'Lister utilisateurs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Utilisateurs' } } },
      post: { summary: 'Creer utilisateur', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Utilisateur cree' } } },
    },
    '/users/{id}': {
      patch: { summary: 'Modifier utilisateur', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Utilisateur modifie' } } },
      delete: { summary: 'Supprimer utilisateur', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Utilisateur supprime' } } },
    },
    '/restaurants': {
      get: { summary: 'Lister restaurants Super Admin', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Restaurants' } } },
      post: { summary: 'Creer restaurant', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Restaurant cree' } } },
    },
    '/restaurants/{id}': { patch: { summary: 'Modifier restaurant', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Restaurant modifie' } } } },
    '/maintenance/backups': {
      get: { summary: 'Lister sauvegardes', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Sauvegardes' } } },
      post: { summary: 'Creer sauvegarde', security: [{ bearerAuth: [] }], responses: { 201: { description: 'Sauvegarde creee' } } },
    },
    '/maintenance/export.db': { get: { summary: 'Exporter base locale', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Base exportee' } } } },
    '/maintenance/restore': { post: { summary: 'Restaurer sauvegarde', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Restauration OK' } } } },
  },
};
