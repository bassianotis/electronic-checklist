import type { Item, WeekKey } from '../types';

interface DragOrigin {
    week: WeekKey;
    orderIndex: number;
    item: Item;
}

/**
 * Pure helper to project items.
 * Spacer logic disabled per user request.
 * Now strictly returns original items.
 */
export const getProjectedItems = (
    items: Item[],
    _dragOrigin: DragOrigin | null,
    _week: WeekKey
): Item[] => {
    // Spacer logic disabled per user request:
    // "So when I drag a card away it doesn't keep that space I drag from 'open' - it immediately closes the space."
    return items;
};
