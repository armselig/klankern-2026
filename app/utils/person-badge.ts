import type { VacationPerson } from "~/types/vacation";
import { AVATAR_INKS } from "./avatar-rosette";

/**
 * The picture of a person without an account, such as a small child: the
 * first two letters of the name on a disc in one of the avatars' inks. A member
 * has a rosette or a photo from the email address; these people have none,
 * and with one icon for all of them two children could not be told apart
 * in a task's row, where only the picture stands.
 */
export interface PersonBadge {
  /** The first two letters of the name, the first in upper case: "Mi". One
   * letter for a name of one, and "?" for an empty name. */
  letters: string;
  /** The ink as a stored color (see utils/ink.ts); inkPaint gives the
   * theme's color for it. */
  color: string;
}

/**
 * The badge of a person. The ink follows from the person's id, so it is
 * the same on every device and stays when the person is renamed; the
 * letters follow the name. Two people can get the same ink, there are
 * eight: then the letters tell them apart. Two of them and not one,
 * because siblings' names start alike often enough ("Mia" and "Max" drew
 * the same picture with one letter when this was tried).
 */
export function personBadge(
  person: Pick<VacationPerson, "id" | "name">,
): PersonBadge {
  // By code point, so a letter outside the basic plane stays whole.
  const [first, second = ""] = Array.from(person.name.trim());
  let sum = 0;
  for (const character of person.id) sum += character.codePointAt(0) ?? 0;
  return {
    letters: first ? first.toLocaleUpperCase() + second : "?",
    color: AVATAR_INKS[sum % AVATAR_INKS.length]!,
  };
}
