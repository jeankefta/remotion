# API de flux immobilier 🏡
## Plus de 20 portails immobiliers: LeBonCoin, PAP, Explorimmo, MeilleursAgents

Les versions de spiders sur ce github sont ceux de ntore v1, ils ont besoin pour certains d'être ajustés aux éventuels changements.
Pour toutes questions, n'hésitez pas à nous contacter sur : [contact@fluximmo.com](mailto:contact@fluximmo.com?subject=[GitHub]%20Hello%20From%20Repo)

✅ Spider Scrapy de la V1 de Fluximmo [DEPRECATED].

✅ V2 accessible en privée: [fluximmo.com](https://fluximmo.com) ou contact@fluximmo.com

### ➡️ Documentation: [api.fluximmo.com](https://api.fluximmo.com/)


# Fluximmo, créer des services innovants grâce au flux d'annonces immo en temps réel

### Une expertise bâtie sur le terrain
Nous nous sommes lancés en Septembre 2017 avec appartenir.com, un service de recherche immobilière. Nous avons donc conçu et construit ce système d'agrégation d'annonces pour être le plus exhaustif, le plus rapide & le plus précis. Après plusieurs mois de service et d'amélioration continue et grâce aux retours de nos utilisateurs, le système est prêt et testé à grande échelle.

### Rapide
Le temps dans l'immobilier, c'est précieux. Nous avons donc conçu une API rapide, qui vous permet de retrouver les annonces quelques minutes seulement après leur publication en ligne !

### Exhaustif
Avec déjà plus de 20 portails immobiliers, nous couvrons plus de 90% des annonces immobilières. Nous continuons d'en ajouter chaque semaine ! N'hésitez-pas à nous contacter si vous souhaitez intégrer un portail unique.

### Intelligent
Notre intelligence artificielle lit les annonces immobilières en temps réel, afin d'extraire le maximum d'informations à partir de la description de chaque annonce. Enfin, basé sur son expérience de plusieurs millions d'annonces, elle détecte les anomalies, et tag les annonces frauduleuses.

---

## Spiders disponibles (mis à jour 2026)

| Spider | Portail | Catégories |
|---|---|---|
| `explorimmo` | explorimmo.com | location |
| `leboncoin` | leboncoin.fr | location, colocation, telephone |
| `meilleursagents` | meilleursagents.com | location |
| `pap` | pap.fr | location |

## Compatibilité

Ces spiders ont été mis à jour pour **Python 3** (2026) :
- `urlparse` → `urllib.parse`
- `print "..."` → `print(...)`
- `super(Class, self)` → `super()`
- Chaînes Unicode natives (plus besoin de `from __future__ import unicode_literals`)
