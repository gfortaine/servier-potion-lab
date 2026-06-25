import type { Locale } from "../i18n/routing";

export interface PotionCopy {
  readonly nav: {
    readonly aria: string;
    readonly dashboard: readonly [string, string];
    readonly composer: readonly [string, string];
    readonly recipes: readonly [string, string];
    readonly inventory: readonly [string, string];
  };
  readonly brand: {
    readonly signature: string;
    readonly promise: string;
  };
  readonly hero: {
    readonly mark: string;
    readonly eyebrow: string;
    readonly title: string;
    readonly body: string;
    readonly cta: string;
    readonly sync: string;
    readonly codex: string;
    readonly criticalStock: string;
  };
  readonly atelier: {
    readonly eyebrow: string;
    readonly title: string;
    readonly body: string;
    readonly viewIntro: {
      readonly dashboard: readonly [string, string];
      readonly composer: readonly [string, string];
      readonly recipes: readonly [string, string];
      readonly inventory: readonly [string, string];
    };
    readonly steps: readonly [string, string, string];
    readonly stepDetails: readonly [string, string, string];
  };
  readonly dashboard: {
    readonly quest: {
      readonly title: string;
      readonly active: string;
      readonly codexProgress: string;
      readonly vaultAlert: string;
      readonly trial: string;
      readonly rank: string;
    };
    readonly cards: {
      readonly composer: readonly [string, string, string];
      readonly recipes: readonly [string, string, string];
      readonly inventory: readonly [string, string, string];
    };
  };
  readonly composer: {
    readonly eyebrow: string;
    readonly title: string;
    readonly guided: string;
    readonly free: string;
    readonly sockets: readonly [string, string, string];
    readonly socketReady: string;
    readonly emptySlot: string;
    readonly remove: string;
    readonly combine: string;
    readonly clear: string;
    readonly randomize: string;
  };
  readonly inventory: {
    readonly eyebrow: string;
    readonly title: string;
    readonly selected: string;
    readonly management: string;
    readonly restock: string;
    readonly stock: string;
    readonly protocolChip: string;
    readonly choose: string;
    readonly remove: string;
    readonly compose: string;
    readonly manage: string;
  };
  readonly recipes: {
    readonly eyebrow: string;
    readonly title: string;
    readonly collection: string;
    readonly created: string;
    readonly pending: string;
    readonly guide: string;
    readonly guided: string;
    readonly success: string;
    readonly composeAgain: string;
  };
  readonly ledger: {
    readonly eyebrow: string;
    readonly title: string;
    readonly empty: string;
  };
  readonly journey: {
    readonly title: string;
    readonly composer: string;
    readonly recipes: string;
    readonly inventory: string;
    readonly discovery: string;
  };
  readonly technical: {
    readonly summary: string;
    readonly body: string;
  };
  readonly notices: {
    readonly loading: string;
    readonly recipePinned: string;
    readonly ingredientRemoved: string;
    readonly depleted: string;
    readonly cap: string;
    readonly ready: string;
    readonly remaining: string;
    readonly fillSlots: string;
    readonly recorded: string;
    readonly recharged: string;
    readonly adjusted: string;
    readonly randomized: string;
    readonly cleared: string;
    readonly unavailable: string;
    readonly invalidRecipe: string;
    readonly insufficient: string;
  };
}

export const potionCopy: Record<Locale, PotionCopy> = {
  fr: {
    nav: {
      aria: "Pages du test technique",
      dashboard: ["Accueil", "Vue mission"],
      composer: ["Composer", "Sélectionner et combiner"],
      recipes: ["Recettes & potions", "Découvertes et registre"],
      inventory: ["Inventaire", "Quantités et recharge"]
    },
    brand: {
      signature: "moved by you / discovery",
      promise: "Proximité patients, partenaires, collaborateurs"
    },
    hero: {
      mark: "Laboratoire SERVIER",
      eyebrow: "Centre de préparation",
      title: "Laboratoire des potions SERVIER.",
      body: "Un parcours clinique et ludique : trois ingrédients, une formule validée, puis une preuve visible dans le registre.",
      cta: "Composer une potion",
      sync: "Synchronisation",
      codex: "Formules",
      criticalStock: "Stock critique"
    },
    atelier: {
      eyebrow: "Parcours de découverte",
      title: "Un laboratoire, trois pages utiles.",
      body: "La navigation reste visible : composer une potion, consulter les recettes validées, ajuster l'inventaire, puis revenir au laboratoire.",
      viewIntro: {
        dashboard: [
          "Mission SERVIER : trois pages, un parcours.",
          "Commencez par composer une potion, vérifiez la formule dans le registre, puis ajustez les stocks si nécessaire."
        ],
        composer: [
          "Composer une potion.",
          "Sélectionnez exactement trois ingrédients. Vous pouvez partir d'une recette épinglée ou tester une hypothèse librement."
        ],
        recipes: [
          "Recettes & potions.",
          "Chaque formule canonique peut guider l'atelier de composition et alimente le registre des potions créées."
        ],
        inventory: [
          "Inventaire des ingrédients.",
          "Ajustez les quantités ingrédient par ingrédient avant de retourner composer une nouvelle hypothèse."
        ]
      },
      steps: ["Choisir", "Compléter", "Valider"],
      stepDetails: ["une recette ou une piste", "ingrédients", "Créer la potion"]
    },
    dashboard: {
      quest: {
        title: "Formule de recherche active",
        active: "Formule active",
        codexProgress: "Formules validées",
        vaultAlert: "Stock à surveiller",
        trial: "préparations validées",
        rank: "Rang de découverte"
      },
      cards: {
        composer: [
          "02",
          "Composer une potion",
          "Sélectionner exactement trois ingrédients et déclencher la validation."
        ],
        recipes: [
          "01",
          "Consulter les recettes",
          "Voir les neuf formules, les découvertes et le registre des potions créées."
        ],
        inventory: [
          "03",
          "Gérer l'inventaire",
          "Ajuster les quantités, recharger et préparer la prochaine composition."
        ]
      }
    },
    composer: {
      eyebrow: "Composition",
      title: "Trois ingrédients, une décision.",
      guided: "{recipe} guide la préparation.",
      free: "Choisissez une formule cible ou composez librement.",
      sockets: ["Ingrédient I", "Ingrédient II", "Ingrédient III"],
      socketReady: "Prêt",
      emptySlot: "Emplacement libre",
      remove: "Retirer",
      combine: "Valider la potion",
      clear: "Effacer",
      randomize: "Réinventer les stocks"
    },
    inventory: {
      eyebrow: "Matières",
      title: "Inventaire vivant",
      selected: "{count}/3 au laboratoire",
      management: "Gestion dédiée du stock",
      restock: "Nouvelle dotation",
      stock: "Stock disponible : {quantity}",
      protocolChip: "Formule",
      choose: "Choisir",
      remove: "Retirer",
      compose: "Composer",
      manage: "Gérer"
    },
    recipes: {
      eyebrow: "Formules",
      title: "Les 9 formules validées",
      collection: "Collection SERVIER",
      created: "Créée",
      pending: "À valider",
      guide: "Préparer cette formule",
      guided: "Formule sélectionnée",
      success: "{recipe} vient d'être validée et ajoutée au registre.",
      composeAgain: "Composer une autre potion"
    },
    ledger: {
      eyebrow: "Registre",
      title: "Potions créées",
      empty: "Aucune potion enregistrée. Validez une formule pour ouvrir le registre."
    },
    journey: {
      title: "Prochaine étape",
      composer: "Composer une hypothèse",
      recipes: "Voir les recettes validées",
      inventory: "Ajuster l'inventaire",
      discovery: "Analyser les candidats"
    },
    technical: {
      summary: "Détails techniques",
      body: "Le parcours est servi par Next.js, NestJS, Prisma et PostgreSQL. Les tests unitaires, API et navigateur restent documentés ici sans parasiter l'expérience métier."
    },
    notices: {
      loading: "Chargement du laboratoire.",
      recipePinned: "{recipe} sélectionnée. Remplissez les trois emplacements.",
      ingredientRemoved: "Ingrédient retiré du laboratoire.",
      depleted: "Stock épuisé : rechargez l'ingrédient avant sélection.",
      cap: "La composition accepte exactement trois ingrédients.",
      ready: "Trois ingrédients en place : validez la potion.",
      remaining: "{count} emplacement(s) encore libres.",
      fillSlots: "Remplissez les trois emplacements du laboratoire.",
      recorded: "{potion} enregistrée dans le registre.",
      recharged: "{ingredient} rechargé.",
      adjusted: "{ingredient} ajusté à {quantity}.",
      randomized: "Nouvelle dotation aléatoire prête.",
      cleared: "Composition réinitialisée.",
      unavailable: "Action indisponible, réessayez.",
      invalidRecipe: "Aucune recette ne correspond à ces trois ingrédients.",
      insufficient: "Stock insuffisant pour valider cette potion."
    }
  },
  en: {
    nav: {
      aria: "Technical test pages",
      dashboard: ["Home", "Mission view"],
      composer: ["Composer", "Select and combine"],
      recipes: ["Recipes & potions", "Discoveries and ledger"],
      inventory: ["Inventory", "Quantities and recharge"]
    },
    brand: {
      signature: "moved by you / discovery",
      promise: "Patients, partners, collaborators in proximity"
    },
    hero: {
      mark: "SERVIER / moved by discovery",
      eyebrow: "Preparation command center",
      title: "SERVIER Potion Discovery Lab.",
      body: "A clinical workflow where every ingredient becomes a visible hypothesis: three choices, nine validated recipes, and an instant evidence ledger.",
      cta: "Compose a potion",
      sync: "Sync",
      codex: "Formulas",
      criticalStock: "Critical stock"
    },
    atelier: {
      eyebrow: "Discovery journey",
      title: "One lab, three useful pages.",
      body: "Navigation stays visible: compose a potion, review validated recipes, adjust inventory, then return to the lab.",
      viewIntro: {
        dashboard: [
          "One lab, three useful pages.",
          "Navigation stays visible: compose a potion, review validated recipes, adjust inventory, then return to the lab."
        ],
        composer: [
          "Compose a potion.",
          "Select exactly three ingredients. Start from a pinned recipe or test a free hypothesis."
        ],
        recipes: [
          "Recipes & potions.",
          "Each canonical formula can guide the composer and feeds the ledger of created potions."
        ],
        inventory: [
          "Ingredient inventory.",
          "Adjust quantities ingredient by ingredient before returning to compose a new hypothesis."
        ]
      },
      steps: ["Choose", "Complete", "Validate"],
      stepDetails: ["a recipe or lead", "ingredients", "Create potion"]
    },
    dashboard: {
      quest: {
        title: "Active research formula",
        active: "Active formula",
        codexProgress: "Validated formulas",
        vaultAlert: "Stock watch",
        trial: "validated preparations",
        rank: "Discovery rank"
      },
      cards: {
        composer: [
          "02",
          "Compose a potion",
          "Select exactly three ingredients and trigger validation."
        ],
        recipes: [
          "01",
          "Review recipes",
          "See the nine formulas, discoveries, and created-potion ledger."
        ],
        inventory: [
          "03",
          "Manage inventory",
          "Adjust quantities, recharge, and prepare the next composition."
        ]
      }
    },
    composer: {
      eyebrow: "Composition",
      title: "Three ingredients, one decision.",
      guided: "{recipe} guides preparation.",
      free: "Choose a target formula or compose freely.",
      sockets: ["Ingredient I", "Ingredient II", "Ingredient III"],
      socketReady: "Ready",
      emptySlot: "Empty slot",
      remove: "Remove",
      combine: "Validate potion",
      clear: "Clear",
      randomize: "Randomize stocks"
    },
    inventory: {
      eyebrow: "Materials",
      title: "Live inventory",
      selected: "{count}/3 in the lab",
      management: "Dedicated stock management",
      restock: "New allocation",
      stock: "Available stock: {quantity}",
      protocolChip: "Formula",
      choose: "Choose",
      remove: "Remove",
      compose: "Compose",
      manage: "Manage"
    },
    recipes: {
      eyebrow: "Formulas",
      title: "The 9 validated formulas",
      collection: "SERVIER collection",
      created: "Created",
      pending: "To validate",
      guide: "Prepare this formula",
      guided: "Selected formula",
      success: "{recipe} has just been validated and added to the ledger.",
      composeAgain: "Compose another potion"
    },
    ledger: {
      eyebrow: "Ledger",
      title: "Created potions",
      empty: "No potion recorded yet. Validate a formula to open the ledger."
    },
    journey: {
      title: "Next step",
      composer: "Compose a hypothesis",
      recipes: "View validated recipes",
      inventory: "Adjust inventory",
      discovery: "Analyze candidates"
    },
    technical: {
      summary: "Technical details",
      body: "The journey is served by Next.js, NestJS, Prisma, and PostgreSQL. Unit, API, and browser tests remain documented here without polluting the business experience."
    },
    notices: {
      loading: "Loading the lab.",
      recipePinned: "{recipe} selected. Fill the three slots.",
      ingredientRemoved: "Ingredient removed from the lab.",
      depleted: "Stock depleted: recharge the ingredient before selecting it.",
      cap: "The composition accepts exactly three ingredients.",
      ready: "Three ingredients ready: validate the potion.",
      remaining: "{count} slot(s) still free.",
      fillSlots: "Fill the three lab slots.",
      recorded: "{potion} recorded in the ledger.",
      recharged: "{ingredient} recharged.",
      adjusted: "{ingredient} adjusted to {quantity}.",
      randomized: "New randomized ingredient allocation ready.",
      cleared: "Composition reset.",
      unavailable: "Action unavailable, please retry.",
      invalidRecipe: "No recipe matches these three ingredients.",
      insufficient: "Insufficient stock to validate this potion."
    }
  }
};

export function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}
