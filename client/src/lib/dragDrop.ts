import { useCallback, useState } from 'react';

export interface DragDropItem {
  id: string;
  type: 'section' | 'bullet-point' | 'skill' | 'experience' | 'education';
  content: string;
  metadata?: {
    category?: string;
    index?: number;
    parentId?: string;
    [key: string]: any;
  };
}

export interface DragDropState {
  draggedItem: DragDropItem | null;
  dropTarget: {
    id: string;
    position: 'before' | 'after' | 'inside';
  } | null;
  isDragging: boolean;
  dragPreview: string;
}

export interface DropZone {
  id: string;
  accepts: string[];
  onDrop: (item: DragDropItem, position?: 'before' | 'after' | 'inside') => void;
  className?: string;
  activeClassName?: string;
}

// Drag and drop hook
export function useDragDrop() {
  const [state, setState] = useState<DragDropState>({
    draggedItem: null,
    dropTarget: null,
    isDragging: false,
    dragPreview: '',
  });

  const startDrag = useCallback((item: DragDropItem, event: React.DragEvent) => {
    // Create drag preview
    const dragPreview = createDragPreview(item);
    
    // Set drag data
    event.dataTransfer.setData('application/json', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image
    const dragImage = createDragImage(item.content);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setState(prev => ({
      ...prev,
      draggedItem: item,
      isDragging: true,
      dragPreview
    }));
  }, []);

  const endDrag = useCallback(() => {
    setState(prev => ({
      ...prev,
      draggedItem: null,
      dropTarget: null,
      isDragging: false,
      dragPreview: ''
    }));
  }, []);

  const enterDropZone = useCallback((zoneId: string, position: 'before' | 'after' | 'inside' = 'inside') => {
    setState(prev => ({
      ...prev,
      dropTarget: { id: zoneId, position }
    }));
  }, []);

  const leaveDropZone = useCallback(() => {
    setState(prev => ({
      ...prev,
      dropTarget: null
    }));
  }, []);

  const handleDrop = useCallback((event: React.DragEvent, dropZone: DropZone) => {
    event.preventDefault();
    
    try {
      const draggedData = event.dataTransfer.getData('application/json');
      if (!draggedData) return;
      
      const item: DragDropItem = JSON.parse(draggedData);
      
      // Check if the drop zone accepts this item type
      if (!dropZone.accepts.includes(item.type)) {
        console.warn(`Drop zone ${dropZone.id} does not accept items of type ${item.type}`);
        return;
      }
      
      // Execute the drop callback
      dropZone.onDrop(item, state.dropTarget?.position);
      
    } catch (error) {
      console.error('Error handling drop:', error);
    } finally {
      endDrag();
    }
  }, [state.dropTarget, endDrag]);

  return {
    state,
    startDrag,
    endDrag,
    enterDropZone,
    leaveDropZone,
    handleDrop,
  };
}

// Create drag preview HTML
function createDragPreview(item: DragDropItem): string {
  const typeColors = {
    'section': '#3b82f6',
    'bullet-point': '#10b981',
    'skill': '#8b5cf6',
    'experience': '#f59e0b',
    'education': '#ef4444'
  };

  const color = typeColors[item.type] || '#6b7280';
  const truncatedContent = item.content.length > 50 
    ? item.content.substring(0, 47) + '...' 
    : item.content;

  return `
    <div style="
      background: white;
      border: 2px solid ${color};
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.4;
    ">
      <div style="
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background: ${color};
          border-radius: 50%;
          margin-right: 8px;
        "></div>
        <span style="
          font-size: 12px;
          color: ${color};
          font-weight: 600;
          text-transform: capitalize;
        ">${item.type.replace('-', ' ')}</span>
      </div>
      <div style="color: #374151;">
        ${truncatedContent}
      </div>
    </div>
  `;
}

// Create drag image element
function createDragImage(content: string): HTMLElement {
  const dragImage = document.createElement('div');
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-1000px';
  dragImage.style.left = '-1000px';
  dragImage.style.background = 'white';
  dragImage.style.border = '2px solid #3b82f6';
  dragImage.style.borderRadius = '8px';
  dragImage.style.padding = '8px 12px';
  dragImage.style.fontSize = '14px';
  dragImage.style.fontFamily = 'system-ui, sans-serif';
  dragImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  dragImage.style.maxWidth = '200px';
  dragImage.style.whiteSpace = 'nowrap';
  dragImage.style.overflow = 'hidden';
  dragImage.style.textOverflow = 'ellipsis';
  
  const truncated = content.length > 30 ? content.substring(0, 27) + '...' : content;
  dragImage.textContent = truncated;
  
  document.body.appendChild(dragImage);
  
  // Clean up after a short delay
  setTimeout(() => {
    if (dragImage.parentNode) {
      document.body.removeChild(dragImage);
    }
  }, 100);
  
  return dragImage;
}

// Utility functions for drag and drop detection
export function getDropPosition(event: React.DragEvent, element: HTMLElement): 'before' | 'after' | 'inside' {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;
  
  if (y < height * 0.25) {
    return 'before';
  } else if (y > height * 0.75) {
    return 'after';
  } else {
    return 'inside';
  }
}

export function isDragOverDropZone(
  event: React.DragEvent, 
  element: HTMLElement,
  threshold: number = 10
): boolean {
  const rect = element.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;
  
  return x >= rect.left - threshold &&
         x <= rect.right + threshold &&
         y >= rect.top - threshold &&
         y <= rect.bottom + threshold;
}

// Visual feedback helpers
export function getDropIndicatorStyle(position: 'before' | 'after' | 'inside'): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '2px',
    background: '#3b82f6',
    borderRadius: '1px',
    zIndex: 1000,
    transition: 'all 0.2s ease',
  };

  switch (position) {
    case 'before':
      return { ...baseStyle, top: '-1px' };
    case 'after':
      return { ...baseStyle, bottom: '-1px' };
    case 'inside':
      return {
        position: 'absolute',
        inset: 0,
        border: '2px dashed #3b82f6',
        borderRadius: '6px',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        pointerEvents: 'none',
        zIndex: 999,
      };
    default:
      return baseStyle;
  }
}

// Content parsers for different item types
export function parseResumeContent(htmlContent: string): DragDropItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const items: DragDropItem[] = [];

  // Parse sections (h1, h2, h3 elements)
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((heading, index) => {
    items.push({
      id: `section-${index}`,
      type: 'section',
      content: heading.textContent || '',
      metadata: {
        level: parseInt(heading.tagName.substring(1)),
        index
      }
    });
  });

  // Parse bullet points (li elements)
  const listItems = doc.querySelectorAll('li');
  listItems.forEach((li, index) => {
    const parentList = li.closest('ul, ol');
    const parentSection = li.closest('section, div[class*="section"]');
    
    items.push({
      id: `bullet-${index}`,
      type: 'bullet-point',
      content: li.textContent || '',
      metadata: {
        index,
        parentId: parentSection?.id || 'unknown',
        listType: parentList?.tagName.toLowerCase() || 'ul'
      }
    });
  });

  return items;
}

// Generate updated HTML from drag/drop operations
export function generateUpdatedContent(
  originalContent: string,
  operations: Array<{
    type: 'move' | 'insert' | 'delete';
    item: DragDropItem;
    targetId?: string;
    position?: 'before' | 'after' | 'inside';
  }>
): string {
  let updatedContent = originalContent;
  
  operations.forEach(operation => {
    switch (operation.type) {
      case 'move':
        updatedContent = moveItem(updatedContent, operation.item, operation.targetId!, operation.position!);
        break;
      case 'insert':
        updatedContent = insertItem(updatedContent, operation.item, operation.targetId!, operation.position!);
        break;
      case 'delete':
        updatedContent = deleteItem(updatedContent, operation.item);
        break;
    }
  });
  
  return updatedContent;
}

function moveItem(content: string, item: DragDropItem, targetId: string, position: 'before' | 'after' | 'inside'): string {
  // Implementation would depend on the specific HTML structure
  // This is a placeholder for the actual move logic
  return content;
}

function insertItem(content: string, item: DragDropItem, targetId: string, position: 'before' | 'after' | 'inside'): string {
  // Implementation would depend on the specific HTML structure
  // This is a placeholder for the actual insert logic
  return content;
}

function deleteItem(content: string, item: DragDropItem): string {
  // Implementation would depend on the specific HTML structure
  // This is a placeholder for the actual delete logic
  return content;
}