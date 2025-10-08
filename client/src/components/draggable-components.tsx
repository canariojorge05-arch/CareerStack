import React, { useState, useRef, useEffect } from "react";
import {
  useDragDrop,
  type DragDropItem,
  type DropZone,
  getDropPosition,
  getDropIndicatorStyle,
} from "@/lib/dragDrop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical,
  Move,
  Plus,
  Trash2,
  Copy,
  Edit3,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DraggablePointProps {
  id: string;
  content: string;
  index: number;
  category: string;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
  isDragOver?: boolean;
  dropPosition?: "before" | "after" | "inside";
}

export function DraggablePoint({
  id,
  content,
  index,
  category,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  isDragOver,
  dropPosition,
}: DraggablePointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const {
    startDrag,
    handleDrop: handleDropFromHook,
    enterDropZone,
    leaveDropZone,
  } = useDragDrop();

  const dragItem: DragDropItem = {
    id,
    type: "bullet-point",
    content,
    metadata: { category, index },
  };

  const dropZone: DropZone = {
    id,
    accepts: ["bullet-point"],
    onDrop: (item, position) => {
      // Handle the drop logic here
    },
  };

  const handleDragStart = (e: React.DragEvent) => {
    startDrag(dragItem, e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (elementRef.current) {
      const position = getDropPosition(e, elementRef.current);
      enterDropZone(id, position);
    }
  };

  const handleDragLeave = () => {
    leaveDropZone();
  };

  const onDropPoint = (e: React.DragEvent) => {
    handleDropFromHook(e, dropZone);
  };

  const handleSave = () => {
    if (editContent.trim() !== content) {
      onUpdate(id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div
      ref={elementRef}
      className={`group relative p-3 rounded-lg transition-all duration-200 ${
        isDragOver
          ? "bg-blue-50 border-2 border-dashed border-blue-300"
          : "bg-card border border-border hover:border-primary/30 hover:shadow-sm"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={onDropPoint}
      data-testid={`draggable-point-${index}`}
    >
      {/* Drop Indicators */}
      {isDragOver && dropPosition && (
        <div style={getDropIndicatorStyle(dropPosition)} />
      )}

      <div className="flex items-start space-x-3">
        {/* Drag Handle */}
        <div
          className={`cursor-grab active:cursor-grabbing transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          draggable
          onDragStart={handleDragStart}
        >
          <GripVertical
            size={16}
            className="text-muted-foreground hover:text-primary"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={Math.max(2, Math.ceil(editContent.length / 60))}
                autoFocus
              />
              <div className="flex space-x-2">
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <p className="text-sm text-foreground leading-relaxed pr-4">
                {content}
              </p>

              {/* Action Buttons */}
              <div
                className={`flex items-center space-x-1 transition-opacity ${
                  isHovered
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit3 size={12} className="mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(id)}>
                      <Copy size={12} className="mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onMove(id, "up")}>
                      <ArrowUp size={12} className="mr-2" />
                      Move Up
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMove(id, "down")}>
                      <ArrowDown size={12} className="mr-2" />
                      Move Down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 size={12} className="mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Badge */}
      {category && (
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className="text-xs opacity-60">
            {category}
          </Badge>
        </div>
      )}
    </div>
  );
}

interface DroppableZoneProps {
  id: string;
  accepts: string[];
  onDrop: (
    item: DragDropItem,
    position?: "before" | "after" | "inside"
  ) => void;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export function DroppableZone({
  id,
  accepts,
  onDrop,
  children,
  className = "",
  placeholder = "Drop items here",
}: DroppableZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<
    "before" | "after" | "inside"
  >("inside");
  const elementRef = useRef<HTMLDivElement>(null);
  const {
    handleDrop: handleDropFromHook,
    enterDropZone,
    leaveDropZone,
  } = useDragDrop();

  const dropZone: DropZone = {
    id,
    accepts,
    onDrop,
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (elementRef.current) {
      const position = getDropPosition(e, elementRef.current);
      setDropPosition(position);
      enterDropZone(id, position);
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only leave if we're actually leaving the element
    if (
      elementRef.current &&
      !elementRef.current.contains(e.relatedTarget as Node)
    ) {
      leaveDropZone();
      setIsDragOver(false);
    }
  };

  const handleDropEvent = (e: React.DragEvent) => {
    setIsDragOver(false);
    handleDropFromHook(e, dropZone);
  };

  return (
    <div
      ref={elementRef}
      className={`relative transition-all duration-200 ${className} ${
        isDragOver
          ? "bg-blue-50/50 border-2 border-dashed border-blue-400 rounded-lg"
          : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      {isDragOver && <div style={getDropIndicatorStyle(dropPosition)} />}

      {children}

      {isDragOver && React.Children.count(children) === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-blue-600">
            <Move className="mx-auto mb-2" size={24} />
            <p className="text-sm font-medium">{placeholder}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface DraggableSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onTitleChange: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  isDragOver?: boolean;
  canDelete?: boolean;
}

export function DraggableSection({
  id,
  title,
  children,
  onTitleChange,
  onDelete,
  onMove,
  isDragOver,
  canDelete = true,
}: DraggableSectionProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const { startDrag, handleDrop, enterDropZone, leaveDropZone } = useDragDrop();

  const dragItem: DragDropItem = {
    id,
    type: "section",
    content: title,
    metadata: { originalTitle: title },
  };

  const dropZone: DropZone = {
    id,
    accepts: ["section", "bullet-point"],
    onDrop: (item, position) => {
      // ...existing code...
    },
  };

  const handleDragStart = (e: React.DragEvent) => {
    startDrag(dragItem, e);
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() !== title && editTitle.trim().length > 0) {
      onTitleChange(id, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setEditTitle(title);
    setIsEditingTitle(false);
  };

  return (
    <div
      ref={elementRef}
      className={`relative group rounded-lg border transition-all duration-200 ${
        isDragOver
          ? "border-blue-300 bg-blue-50/50 shadow-lg"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          {/* Drag Handle */}
          <div
            className={`cursor-grab active:cursor-grabbing transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            draggable
            onDragStart={handleDragStart}
          >
            <GripVertical
              size={16}
              className="text-muted-foreground hover:text-primary"
            />
          </div>

          {/* Section Title */}
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") handleCancelTitle();
                }}
                className="px-2 py-1 text-lg font-semibold bg-transparent border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveTitle}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelTitle}>
                Cancel
              </Button>
            </div>
          ) : (
            <h3
              className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary"
              onClick={() => setIsEditingTitle(true)}
            >
              {title}
            </h3>
          )}
        </div>

        {/* Section Actions */}
        <div
          className={`flex items-center space-x-1 transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(id, "up")}
            title="Move section up"
          >
            <ArrowUp size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMove(id, "down")}
            title="Move section down"
          >
            <ArrowDown size={14} />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete section"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Section Content */}
      <DroppableZone
        id={`${id}-content`}
        accepts={["bullet-point"]}
        onDrop={(item, position) => {
          // ...existing code...
        }}
        className="p-4 min-h-[100px]"
        placeholder="Drop bullet points here"
      >
        {children}
      </DroppableZone>
    </div>
  );
}

interface AddItemButtonProps {
  onAdd: () => void;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

export function AddItemButton({
  onAdd,
  label,
  icon = <Plus size={16} />,
  className = "",
}: AddItemButtonProps) {
  return (
    <Button
      variant="outline"
      className={`w-full border-dashed border-2 text-muted-foreground hover:text-foreground hover:border-primary transition-all ${className}`}
      onClick={onAdd}
    >
      {icon}
      <span className="ml-2">{label}</span>
    </Button>
  );
}

// Utility component for visual feedback during drag operations
export function DragOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 bg-blue-500/5" />
  );
}
