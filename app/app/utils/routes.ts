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
  joinPrefix: "/join/",
  join: (code: string) => `/join/${code}`,
} as const;
