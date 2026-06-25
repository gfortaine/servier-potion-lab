import type { Ingredient, Recipe } from "./types.js";

export const INGREDIENTS = [
  { id: "argent", name: "Argent" },
  { id: "bave-de-lama", name: "Bave de lama" },
  { id: "epine-de-herisson", name: "Épine de hérisson" },
  { id: "plume-de-griffon", name: "Plume de griffon" },
  { id: "helium-liquide", name: "Hélium liquide" },
  { id: "poil-de-yeti", name: "Poil de yéti" },
  { id: "or", name: "Or" },
  { id: "azote-liquide", name: "Azote liquide" },
  { id: "queue-d-ecureuil", name: "Queue d'écureuil" },
  { id: "crin-de-licorne", name: "Crin de licorne" },
  { id: "jus-de-horglup", name: "Jus de Horglup" },
  { id: "noix-de-coco", name: "Noix de coco" },
  { id: "yttrium", name: "Yttrium" },
  { id: "mandragore", name: "Mandragore" }
] as const satisfies readonly Ingredient[];

export const RECIPES = [
  {
    id: "invisibilite",
    name: "Potion d'invisibilité",
    ingredientIds: ["noix-de-coco", "yttrium", "mandragore"]
  },
  {
    id: "amour",
    name: "Potion d'amour",
    ingredientIds: ["bave-de-lama", "plume-de-griffon", "helium-liquide"]
  },
  {
    id: "jeunesse",
    name: "Potion de jeunesse",
    ingredientIds: ["or", "crin-de-licorne", "azote-liquide"]
  },
  {
    id: "immortalite",
    name: "Potion d'immortalité",
    ingredientIds: ["poil-de-yeti", "jus-de-horglup", "argent"]
  },
  {
    id: "clairvoyance",
    name: "Potion de Clairvoyance",
    ingredientIds: ["epine-de-herisson", "jus-de-horglup", "noix-de-coco"]
  },
  {
    id: "force",
    name: "Potion de Force",
    ingredientIds: ["poil-de-yeti", "or", "argent"]
  },
  {
    id: "vitesse",
    name: "Potion de Vitesse",
    ingredientIds: ["helium-liquide", "plume-de-griffon", "azote-liquide"]
  },
  {
    id: "guerison",
    name: "Potion de Guérison",
    ingredientIds: ["crin-de-licorne", "mandragore", "bave-de-lama"]
  },
  {
    id: "transformation",
    name: "Potion de Transformation",
    ingredientIds: ["queue-d-ecureuil", "yttrium", "epine-de-herisson"]
  }
] as const satisfies readonly Recipe[];
