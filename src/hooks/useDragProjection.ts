import { useMemo } from 'react';
import type { Item, WeekKey } from '../types';

interface DragOrigin {
    week: WeekKey;
    orderIndex: number;
    item: Item;
}

interface UseDragProjectionProps {
    items: Item[];
    dragOrigin: DragOrigin | null;
    week: WeekKey;
}

export const useDragProjection = ({ items, dragOrigin, week }: UseDragProjectionProps) => {
    return useMemo(() => {
        // If we are not dragging, or this week is unrelated to the drag origin, return original items
        if (!dragOrigin || dragOrigin.week !== week) {
            return items;
        }

        // We are in the origin week. Check if the item is still physically present in the list
        // (meaning it hasn't been reordered away yet, or it has)

        const isItemInList = items.some(i => i.id === dragOrigin.item.id);

        if (isItemInList) {
            // Item is still here, no spacer needed (or rather, the item itself acts as placeholder)
            // But usually we hide the dragged item visually via CSS opacity
            return items;
        }

        // Item has moved out! Insert a "Ghost Spacer" at the original index
        // to preserve the layout stability (the "Safety Rule")
        const projectedItems = [...items];
        const insertIdx = Math.min(dragOrigin.orderIndex, projectedItems.length);

        projectedItems.splice(insertIdx, 0, {
            ...dragOrigin.item,
            isSpacer: true
        } as Item & { isSpacer?: boolean });

        return projectedItems;
    }, [items, dragOrigin, week]);
};
