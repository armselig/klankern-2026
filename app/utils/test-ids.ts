/**
 * Single source for the `data-testid` values the end-to-end tests find
 * elements by. A test that looks for a label or a button's text breaks with
 * every reworded or translated line; an id only changes when the element
 * itself goes. The templates bind these (`:data-testid="TEST_IDS.list.row"`)
 * and the tests import them, so a misspelled id fails the type check on
 * either side instead of being a locator that silently matches nothing.
 *
 * An id names a kind of element, not one instance: every row of a list has
 * the same one, and a test picks its row by what it typed into it.
 */
export const TEST_IDS = {
  /** Every place that shows an error's message, whatever the error. */
  errorMessage: "error-message",
  /** The buttons of the dialogs Quasar's plugin builds (see `withTestId`). */
  confirmDialog: {
    ok: "confirm-dialog-ok",
    cancel: "confirm-dialog-cancel",
  },
  layout: {
    homeLink: "layout-home-link",
    installButton: "layout-install-button",
    loginLink: "layout-login-link",
    appVersion: "layout-app-version",
    versionButton: "layout-version-button",
    versionMenu: "layout-version-menu",
  },
  /** `public/offline.html` is static and has this value written out. */
  offlinePage: { heading: "offline-heading" },
  pwa: {
    updateNotice: "pwa-update-notice",
    updateReload: "pwa-update-reload",
  },
  /** The two steps of signing in, on the login page and the join page. */
  signIn: {
    email: "sign-in-email",
    sendCode: "sign-in-send-code",
    sentNotice: "sign-in-sent-notice",
    code: "sign-in-code",
    submit: "sign-in-submit",
    changeEmail: "sign-in-change-email",
  },
  login: { heading: "login-heading" },
  join: { heading: "join-heading" },
  account: {
    button: "account-button",
    avatar: "account-avatar",
    menu: "account-menu",
    invite: "account-invite",
    signOut: "account-sign-out",
  },
  household: {
    name: "household-name",
    createForm: "household-create-form",
    nameInput: "household-name-input",
    createButton: "household-create-button",
    members: "household-members",
    member: "household-member",
    memberAvatar: "household-member-avatar",
    inviteButton: "household-invite-button",
    /** What a page shows instead of its content without a household. */
    requiredNotice: "household-required-notice",
    requiredLink: "household-required-link",
  },
  invite: {
    link: "invite-link",
  },
  /** The Tonight tile on the dashboard. */
  tonight: {
    headline: "tonight-headline",
    secondary: "tonight-secondary",
    planThis: "tonight-plan-this",
    another: "tonight-another",
    skip: "tonight-skip",
    undoSkip: "tonight-undo-skip",
    change: "tonight-change",
    writeRecipe: "tonight-write-recipe",
    addText: "tonight-add-text",
  },
  /** The meal plan page, /meals. */
  meals: {
    heading: "meals-heading",
    loading: "meals-loading",
    failure: "meals-failure",
    day: "meals-day",
    /** A slot's part of a day: Dinner, Breakfast, Lunch or Snack. */
    slot: "meals-slot",
    slotHeading: "meals-slot-heading",
    entry: "meals-entry",
    entryRecipeLink: "meals-entry-recipe-link",
    entryMore: "meals-entry-more",
    entryMenu: {
      group: "meals-entry-menu",
      makeRecipe: "meals-entry-make-recipe",
      move: "meals-entry-move",
      markCooked: "meals-entry-mark-cooked",
      remove: "meals-entry-remove",
    },
    add: "meals-add",
    /** The buttons that add a breakfast, a lunch or a snack. */
    addOtherSlot: "meals-add-other-slot",
    putOnList: "meals-put-on-list",
    putOnListNotice: "meals-put-on-list-notice",
    putOnListFailure: "meals-put-on-list-failure",
    trip: {
      heading: "meals-trip-heading",
      allWeeks: "meals-trip-all-weeks",
      notFound: "meals-trip-not-found",
    },
    moveDialog: {
      title: "meals-move-title",
      slot: "meals-move-slot",
      day: "meals-move-day",
      date: "meals-move-date",
      submit: "meals-move-submit",
    },
    empty: "meals-empty",
    undoRemoval: "meals-undo-removal",
    previousWeek: "meals-previous-week",
    nextWeek: "meals-next-week",
    thisWeek: "meals-this-week",
    dialog: {
      title: "meals-dialog-title",
      input: "meals-dialog-input",
      recipe: "meals-dialog-recipe",
      addText: "meals-dialog-add-text",
      error: "meals-dialog-error",
    },
  },
  dashboard: {
    tile: {
      todos: "dashboard-tile-todos",
      shopping: "dashboard-tile-shopping",
      recipes: "dashboard-tile-recipes",
      vacations: "dashboard-tile-vacations",
      tonight: "dashboard-tile-tonight",
      whiteboard: "dashboard-tile-whiteboard",
    },
    tileLink: "dashboard-tile-link",
    tileCount: "dashboard-tile-count",
    /** A line of a tile's preview, the one that says how many more too. */
    tileEntry: "dashboard-tile-entry",
    tileEmpty: "dashboard-tile-empty",
    vacationsAll: "dashboard-vacations-all",
  },
  /** What the to-dos and the shopping list have in common. */
  list: {
    items: "list-items",
    row: "list-row",
    checkbox: "list-checkbox",
    remove: "list-remove",
    empty: "list-empty",
  },
  todos: {
    titleInput: "todos-title-input",
    addButton: "todos-add-button",
  },
  shopping: {
    titleInput: "shopping-title-input",
    quantityInput: "shopping-quantity-input",
  },
  avatar: {
    drawing: "avatar-drawing",
    photo: "avatar-photo",
  },
  whiteboard: {
    surface: "whiteboard-surface",
    board: "whiteboard-board",
    /** A stroke wherever one is drawn: board, preview and avatar. */
    stroke: "whiteboard-stroke",
    preview: "whiteboard-preview",
    tools: "whiteboard-tools",
    colors: "whiteboard-colors",
    widths: "whiteboard-widths",
    undo: "whiteboard-undo",
    clear: "whiteboard-clear",
  },
  recipe: {
    list: {
      add: "recipe-list-add",
      items: "recipe-list-items",
      link: "recipe-list-link",
      empty: "recipe-list-empty",
    },
    form: {
      title: "recipe-form-title",
      servings: "recipe-form-servings",
      ingredientRow: "recipe-form-ingredient-row",
      ingredientName: "recipe-form-ingredient-name",
      ingredientQuantity: "recipe-form-ingredient-quantity",
      ingredientRemove: "recipe-form-ingredient-remove",
      addIngredient: "recipe-form-add-ingredient",
      instructions: "recipe-form-instructions",
      save: "recipe-form-save",
      notFound: "recipe-form-not-found",
    },
    view: {
      back: "recipe-view-back",
      title: "recipe-view-title",
      servings: "recipe-view-servings",
      edit: "recipe-view-edit",
      remove: "recipe-view-remove",
      ingredient: "recipe-view-ingredient",
      addToShopping: "recipe-view-add-to-shopping",
      instructions: "recipe-view-instructions",
      notFound: "recipe-view-not-found",
    },
    addedNotice: "recipe-added-notice",
    removedNotice: "recipe-removed-notice",
  },
  vacation: {
    list: {
      add: "vacation-list-add",
      link: "vacation-list-link",
      empty: "vacation-list-empty",
    },
    form: {
      title: "vacation-form-title",
      kinds: "vacation-form-kinds",
      from: "vacation-form-from",
      until: "vacation-form-until",
      person: "vacation-form-person",
      addName: "vacation-form-add-name",
      copyFrom: "vacation-form-copy-from",
      submit: "vacation-form-submit",
    },
    view: {
      back: "vacation-view-back",
      notFound: "vacation-view-not-found",
    },
    header: {
      title: "vacation-header-title",
      summary: "vacation-header-summary",
      edit: "vacation-header-edit",
      titleInput: "vacation-header-title-input",
      kinds: "vacation-header-kinds",
      from: "vacation-header-from",
      until: "vacation-header-until",
      save: "vacation-header-save",
      cancel: "vacation-header-cancel",
      remove: "vacation-header-remove",
    },
    share: {
      line: "vacation-share-line",
      hint: "vacation-share-hint",
      changePeople: "vacation-share-change-people",
    },
    people: {
      row: "vacation-people-row",
      coming: "vacation-people-coming",
      nameInput: "vacation-people-name-input",
      done: "vacation-people-done",
    },
    phase: {
      before: "vacation-phase-before",
      during: "vacation-phase-during",
      after: "vacation-phase-after",
    },
    meals: {
      link: "vacation-meals-link",
    },
    phaseToggle: "vacation-phase-toggle",
    phaseSummary: "vacation-phase-summary",
    addTask: "vacation-add-task",
    task: {
      row: "vacation-task-row",
      checkbox: "vacation-task-checkbox",
      who: "vacation-task-who",
      more: "vacation-task-more",
      titleInput: "vacation-task-title-input",
      reason: "vacation-task-reason",
    },
    taskMenu: {
      group: "vacation-task-menu",
      edit: "vacation-task-menu-edit",
      reject: "vacation-task-menu-reject",
      remove: "vacation-task-menu-remove",
    },
    giveMenu: {
      group: "vacation-give-menu",
      me: "vacation-give-menu-me",
      person: "vacation-give-menu-person",
    },
    reject: {
      reason: "vacation-reject-reason",
      submit: "vacation-reject-submit",
    },
  },
} as const;

/** The dashboard's tiles, by the key of their id. */
export type DashboardTileKey = keyof typeof TEST_IDS.dashboard.tile;

/**
 * Adds a test id to the props of an element that Quasar builds from an
 * object instead of a template: a plugin dialog's button, a notice's action.
 * Quasar passes an unknown key on to the element as an attribute, but its
 * types name only the props, and an object literal with the attribute in it
 * would not compile.
 */
export function withTestId<Props extends object>(
  props: Props,
  testId: string,
): Props {
  return { ...props, "data-testid": testId };
}
