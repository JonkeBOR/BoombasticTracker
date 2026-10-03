'use client';

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { fitnessStrings } from '@/lib/strings/fitness';
import { InlineError } from './InlineError';
import styles from './SortableList.module.css';
import { useReorder } from './useReorder';

const longPress = { delay: 250, tolerance: 5 };

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type SortableListProps<Item extends { id: string }> = {
  items: readonly Item[];
  className?: string | undefined;
  labelledBy: string;
  itemName: (item: Item) => string;
  moveUrl: (item: Item) => string;
  renderItem: (item: Item, dragHandle: ReactNode) => ReactNode;
};

export function SortableList<Item extends { id: string }>({
  items,
  className,
  labelledBy,
  itemName,
  moveUrl,
  renderItem,
}: SortableListProps<Item>) {
  const reordering = useReorder(items, moveUrl);
  const contextId = useId();
  const justDropped = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: longPress }),
    useSensor(TouchSensor, { activationConstraint: longPress }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = reordering.items.map((item) => item.id);
  const nameOf = (id: string | number) => {
    const item = reordering.items.find((candidate) => candidate.id === id);
    return item ? itemName(item) : '';
  };
  const positionOf = (id: string | number) => ids.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => fitnessStrings.reorder.pickedUp(nameOf(active.id)),
    onDragOver: ({ active, over }) =>
      over
        ? fitnessStrings.reorder.movedTo(nameOf(active.id), positionOf(over.id), ids.length)
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? fitnessStrings.reorder.droppedAt(nameOf(active.id), positionOf(over.id), ids.length)
        : fitnessStrings.reorder.cancelled(nameOf(active.id)),
    onDragCancel: ({ active }) => fitnessStrings.reorder.cancelled(nameOf(active.id)),
  };

  function rememberPointerDrop(activatorEvent: Event) {
    justDropped.current = !(activatorEvent instanceof KeyboardEvent);
  }

  function dropped({ active, over, activatorEvent }: DragEndEvent) {
    rememberPointerDrop(activatorEvent);
    void reordering.move(String(active.id), over === null ? null : String(over.id));
  }

  function forgetDrop() {
    justDropped.current = false;
  }

  function swallowClickAfterDrop(event: MouseEvent) {
    if (justDropped.current) {
      justDropped.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <>
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: fitnessStrings.reorder.instructions },
        }}
        onDragStart={forgetDrop}
        onDragEnd={dropped}
        onDragCancel={({ activatorEvent }) => rememberPointerDrop(activatorEvent)}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul
            className={className}
            aria-labelledby={labelledBy}
            onClickCapture={swallowClickAfterDrop}
            onPointerDownCapture={forgetDrop}
            onKeyDownCapture={forgetDrop}
          >
            {reordering.items.map((item) => (
              <SortableItem
                key={item.id}
                id={item.id}
                name={itemName(item)}
                disabled={reordering.pending}
              >
                {(dragHandle) => renderItem(item, dragHandle)}
              </SortableItem>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <InlineError message={reordering.errorMessage} />
    </>
  );
}

type SortableItemProps = {
  id: string;
  name: string;
  disabled: boolean;
  children: (dragHandle: ReactNode) => ReactNode;
};

function SortableItem({ id, name, disabled, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    attributes: { roleDescription: fitnessStrings.reorder.roleDescription },
  });
  const nodeRef = useRef<HTMLLIElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLLIElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }
    node.style.setProperty('--sortable-transform', CSS.Translate.toString(transform) ?? 'none');
    node.style.setProperty('--sortable-transition', transition ?? 'none');
  }, [transform, transition]);

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className={styles.handle}
      {...attributes}
      aria-label={fitnessStrings.reorder.handleFor(name)}
    >
      <GripVertical className={styles.handleIcon} aria-hidden="true" />
    </button>
  );

  return (
    <li ref={setRefs} className={isDragging ? styles.dragging : styles.item} {...listeners}>
      {children(dragHandle)}
    </li>
  );
}
