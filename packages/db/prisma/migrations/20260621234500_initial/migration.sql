CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "ingredients" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "recipes" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "ingredient_ids" text[] NOT NULL CHECK (cardinality("ingredient_ids") = 3),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "inventory_items" (
  "ingredient_id" text PRIMARY KEY REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" integer NOT NULL CHECK ("quantity" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "potions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipe_id" text NOT NULL REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" text NOT NULL,
  "ingredient_ids" text[] NOT NULL CHECK (cardinality("ingredient_ids") = 3),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
