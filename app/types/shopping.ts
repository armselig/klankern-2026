import type { Database } from "./database.types";

export type ShoppingList =
  Database["public"]["Tables"]["shopping_lists"]["Row"];
export type ShoppingItem =
  Database["public"]["Tables"]["shopping_items"]["Row"];
