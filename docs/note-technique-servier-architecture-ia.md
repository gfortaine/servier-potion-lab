# Note technique SERVIER: architecture IA et trajectoire de delivery

Cette note remplace l'ancien livrable Word binaire par une version Markdown lisible, diffable et maintenable dans le depot public. Elle conserve le cadrage Tech Lead IA: livrer vite, expliquer les compromis, et garder une preuve technique verifiable.

## Synthese executive

Le test SERVIER est traite comme un mini-produit demontrable plutot que comme un simple exercice algorithmique. La solution transforme une regle metier de recettes et d'inventaire en experience applicative testable, industrialisable et lisible par un evaluateur technique.

La livraison combine une interface Next.js, une API NestJS, un domaine TypeScript deterministe, PostgreSQL via Prisma, un assistant Potion avec appel d'outil borne, et un serveur MCP optionnel pour les agents externes. L'IA est positionnee comme une capacite de delivery encadree: elle accelere la production, mais les preuves restent dans le code, les tests, la documentation et les commandes reproductibles.

## Monolithe modulaire vs miniservices

Le choix n'est ni un monolithe classique ni une dispersion prematuree en microservices. Le projet adopte un monorepo modulaire qui conserve la vitesse d'execution d'un monolithe tout en posant des frontieres proches de miniservices, pretes a etre extraites si l'organisation, la scalabilite ou la gouvernance l'exigent.

| Modele | Benefice | Limite | Lecture SERVIER |
|---|---|---|---|
| Monolithe | Vitesse, simplicite de deploiement, coherence locale | Risque de couplage si les frontieres restent implicites | Utile pour aller vite, a condition de rendre les modules explicites |
| Miniservices | Autonomie d'equipes et extraction ciblee | Complexite operationnelle prematuree pour un test court | A reserver aux besoins reels de separation et d'exploitation |
| Monorepo modulaire | Graphe unique, contrats partages, extraction future | Necessite une discipline de dependances | Compromis retenu pour livrer vite et proprement |

Les frontieres applicatives sont explicites: `apps/web` porte l'experience utilisateur, `apps/api` expose les contrats serveur, `packages/domain` isole les regles metier, `packages/db` formalise la trajectoire PostgreSQL, `packages/potion-tools` concentre les outils bornes, et `apps/mcp` reste un adaptateur agent separe.

## Pourquoi Turborepo

Turborepo orchestre Next.js, NestJS et les packages partages dans un graphe de taches unique. pnpm assure un workspace coherent, limite la duplication de dependances et rend les commandes `build`, `test`, `lint`, `typecheck` et `verify` reproductibles sur l'ensemble du depot.

Le domaine reste pur et typé: il ne depend ni du web, ni de l'API, ni de Prisma, ni d'un LLM. Les regles critiques peuvent donc etre verifiees localement puis reutilisees par l'API, l'interface, l'assistant et le MCP sans divergence de comportement.

## IA operationnelle

La valeur IA operationnelle n'est pas seulement dans l'assistant produit. Elle est aussi dans la methode de livraison: boucles de verification, separation des responsabilites, preuves commandees, validation humaine sur l'UI, et documentation de decisions.

Le bonus assistant est volontairement borne. Dans le navigateur, le modele ne voit qu'un outil executable: `create_potion`. L'API valide ensuite le plan et execute la mutation via `PotionToolService -> PotionLabApplication -> PrismaPotionRepository`. Les outils plus larges (`list_inventory`, `recharge_inventory`, `randomize_inventory`, etc.) sont reserves au serveur MCP optionnel pour agents externes.

Cette separation evite de confondre "demo impressionnante" et surface d'action trop permissive. L'IA apporte l'effet wow par la conversation et l'appel d'outil, mais les garde-fous restent dans l'architecture.

## Modernisation et trajectoire cloud

La version obligatoire reste locale, deterministe et verifiable. La trajectoire d'industrialisation est toutefois lisible:

- Vercel Services pour la demonstration web/API rapide;
- PostgreSQL et Prisma pour la persistance transactionnelle;
- GitHub Actions pour lint, typecheck, tests, build, API e2e et Playwright;
- Azure Container Apps ou AKS pour une cible entreprise;
- Key Vault ou secrets de plateforme pour les variables sensibles;
- Azure Monitor/Application Insights pour l'observabilite;
- Azure OpenAI, OpenAI-compatible ou Mistral derriere le meme contrat de planification.

Cette trajectoire permet de montrer une modernisation credible sans surpromettre une plateforme complete dans le perimetre du test.

## Contrainte de temps

La contrainte d'un week-end force la priorisation: comprehension metier, architecture lisible, experience utilisable, regles testees, documentation exploitable et chemin de deploiement credible.

Elle reduit l'overengineering. Les elements longs d'industrialisation sont differes, mais les marqueurs de qualite restent presents: TypeScript strict, tests automatises, build reproductible, documentation d'architecture, secrets hors code et revue independante.

## Conclusion

Cette livraison montre une architecture assez simple pour etre produite vite et assez structuree pour grandir. Le compromis monorepo Turborepo, monolithe modulaire et frontieres de miniservices repond au test sans complexite artificielle, tout en preparant une trajectoire cloud et IA credible pour une mission SERVIER.
