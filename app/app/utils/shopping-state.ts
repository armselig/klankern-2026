import type { ItemsById } from '~/types/list'
import type { ShoppingItem } from '~/types/shopping'
import { visibleListItems } from './list-state'

/** While shopping, what's still to buy stays on top: checked items sink to
 * the bottom, both groups keeping their list order. */
export function visibleShoppingItems(itemsById: ItemsById<ShoppingItem>): ShoppingItem[] {
  return visibleListItems(itemsById).sort((a, b) => Number(a.checked) - Number(b.checked))
}
