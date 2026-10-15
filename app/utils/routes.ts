/** Single source for the app's URLs, so a renamed route is changed in one
 * place. The pages themselves still get their paths from file-based routing:
 * renaming a route means changing it here and renaming the file in `pages/`. */
export const ROUTES = {
  home: "/",
  login: "/login",
  confirm: "/confirm",
  todos: "/todos",
  shopping: "/shopping",
  whiteboard: "/whiteboard",
  recipes: "/recipes",
  recipeNew: "/recipes/new",
  recipe: (id: string) => `/recipes/${id}`,
  recipeEdit: (id: string) => `/recipes/${id}/edit`,
  meals: "/meals",
  tripMeals: (vacationId: string) => `/meals?trip=${vacationId}`,
  kids: "/kids",
  vacations: "/vacations",
  vacationNew: "/vacations/new",
  vacation: (id: string) => `/vacations/${id}`,
  joinPrefix: "/join/",
  join: (code: string) => `/join/${code}`,
} as const;
