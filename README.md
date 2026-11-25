# API Koha SRU

API REST pour interroger le serveur SRU de Koha et récupérer les notices bibliographiques.

## Endpoints

### GET /api/sru

Récupère les notices correspondant à un ISBN ou ISSN.

#### Paramètres
- \`isbn\` (optionnel) : ISBN à rechercher
- \`issn\` (optionnel) : ISSN à rechercher
- \`limit\` (optionnel, défaut: 5) : Nombre maximum de résultats (1-20)

#### Exemple de requête
\`\`\`
GET /api/sru?isbn=9791037516909
\`\`\`

#### Exemple de réponse
\`\`\`json
{
  "success": true,
  "identifier": "9791037516909",
  "count": 1,
  "total": 1,
  "notices": [
    {
      "biblionumber": "12345678",
      "opac_url": "https://catalogue.univ-amu.fr/cgi-bin/koha/opac-detail.pl?biblionumber=12345678"
    }
  ]
}
\`\`\`

## Déploiement

1. Installer Wrangler : npm install -D wrangler
2. Configurer les variables d'environnement dans Cloudflare
3. Déployer : npx wrangler deploy