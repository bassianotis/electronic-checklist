import type { Active, Over } from '@dnd-kit/core';
import type { Item } from '../types';

// --- Constants ---

export const DRAG_ACTIVATION_DISTANCE = 5; // pixels
export const SPACER_ID_PREFIX = 'spacer-';

// --- Helpers ---

/**
 * Resolves the real item ID from a potential spacer ID.
 * Example: "spacer-item-123" -> "item-123"
 */
export const resolveId = (id: string): string => {
    return id.startsWith(SPACER_ID_PREFIX) ? id.replace(SPACER_ID_PREFIX, '') : id;
};

/**
 * Checks if an ID represents a spacer.
 */
export const isSpacerId = (id: string): boolean => {
    return id.startsWith(SPACER_ID_PREFIX);
};

/**
 * Generates a spacer ID for a given item ID.
 */
export const getSpacerId = (itemId: string): string => {
    return `${SPACER_ID_PREFIX}${itemId}`;
};

/**
 * Calculates the precise insertion index based on cursor position relative to the target item.
 * Override default dnd-kit logic to prevent "jumping" when dragging between containers.
 * 
 * Rule: Insert AFTER the item only if the cursor is below the item's vertical center.
 */
interface CalculateIndexParams {
    active: Active;
    over: Over;
    overItem: Item;
    weekItems: Item[];
}

export const calculateInsertionIndex = ({
    active,
    over,
    overItem,
    weekItems,
}: CalculateIndexParams): number => {
    const overIndex = weekItems.indexOf(overItem);

    // Safety check for rectangles
    if (!active.rect.current.translated || !over.rect) {
        return overIndex;
    }

    // Manual Center Check
    // Calculate vertical centers
    const activeCenterY = active.rect.current.translated.top + (active.rect.current.translated.height / 2);
    const overCenterY = over.rect.top + (over.rect.height / 2);

    // If active center is below over center, we are "past" the item
    const isBelow = activeCenterY > overCenterY;

    // If below, insert after (index + 1). Else, insert before (index).
    return isBelow ? overIndex + 1 : overIndex;
};
