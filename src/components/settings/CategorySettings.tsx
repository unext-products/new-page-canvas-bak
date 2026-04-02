import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
import { Loader2, Plus, Trash2, GripVertical, Info, ChevronRight, FolderPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string | null;
  parent_id: string | null;
  sort_order: number;
  role_scope: string[];
  created_at: string;
}

// Sortable Category Item Component
function SortableCategoryItem({ 
  category, 
  onToggleActive, 
  onDelete,
  onAddActivity,
  isParent,
  childCount,
  roleLabel,
}: { 
  category: Category;
  onToggleActive: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddActivity?: (parentId: string) => void;
  isParent: boolean;
  childCount?: number;
  roleLabel: (role: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
        isDragging && "opacity-50 shadow-lg",
        isParent && "bg-muted/30 border-primary/20",
        !isParent && "ml-6 border-dashed"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      
      {isParent && <FolderPlus className="h-4 w-4 text-primary" />}
      {!isParent && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn("font-medium truncate", isParent && "text-primary")}>
            {category.name}
          </p>
          {isParent && childCount !== undefined && childCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({childCount} {childCount === 1 ? 'activity' : 'activities'})
            </span>
          )}
          {isParent && category.role_scope && category.role_scope.length < 3 && (
            <div className="flex gap-1">
              {category.role_scope.map(role => (
                <Badge key={role} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {category.description && (
          <p className="text-sm text-muted-foreground truncate">
            {category.description}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {isParent && onAddActivity && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddActivity(category.id)}
            className="text-primary hover:text-primary"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Activity
          </Button>
        )}
        <Switch
          checked={category.is_active}
          onCheckedChange={() => onToggleActive(category)}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {isParent ? "Category" : "Activity"}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{category.name}"? 
                {isParent && childCount && childCount > 0 && " This will also delete all activities under it."}
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(category)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

interface CategorySettingsProps {
  organizationId?: string;
}

export default function CategorySettings({ organizationId }: CategorySettingsProps) {
  const { userWithRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"category" | "activity">("category");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // New category/activity form
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCategories();
  }, [userWithRole, organizationId]);

  // Separate parent categories and child activities
  const parentCategories = useMemo(() => {
    return categories
      .filter(c => c.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categories]);

  const getChildren = (parentId: string) => {
    return categories
      .filter(c => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      
      // Filter by organization
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      } else {
        // Regular org admin - filter by their own org
        const { data: orgId } = await supabase.rpc("get_user_organization", {
          user_id: userWithRole?.user.id,
        });
        if (orgId) {
          query = query.eq("organization_id", orgId);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to include default values for new columns
      const mappedData = (data || []).map(cat => ({
        ...cat,
        parent_id: cat.parent_id || null,
        sort_order: cat.sort_order || 0,
      }));
      
      setCategories(mappedData);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddCategoryDialog = () => {
    setDialogMode("category");
    setSelectedParentId(null);
    setNewName("");
    setNewDescription("");
    setDialogOpen(true);
  };

  const openAddActivityDialog = (parentId: string) => {
    setDialogMode("activity");
    setSelectedParentId(parentId);
    setNewName("");
    setNewDescription("");
    setDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get organization_id - use passed prop or fetch from user
      let orgId = organizationId;
      if (!orgId) {
        const { data: orgData } = await supabase.rpc("get_user_organization", {
          user_id: userWithRole?.user.id,
        });
        orgId = orgData;
      }

      // Calculate sort_order
      let sortOrder = 0;
      if (dialogMode === "category") {
        sortOrder = parentCategories.length;
      } else if (selectedParentId) {
        sortOrder = getChildren(selectedParentId).length;
      }

      const { error } = await supabase.from("activity_categories").insert({
        organization_id: orgId,
        name: newName.trim(),
        description: newDescription.trim() || null,
        parent_id: dialogMode === "activity" ? selectedParentId : null,
        sort_order: sortOrder,
      });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `${dialogMode === "category" ? "Category" : "Activity"} added` 
      });
      setDialogOpen(false);
      fetchCategories();
    } catch (error: any) {
      console.error("Error adding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      const { error } = await supabase
        .from("activity_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;

      setCategories(prev => 
        prev.map(c => c.id === category.id ? { ...c, is_active: !c.is_active } : c)
      );

      toast({
        title: "Success",
        description: `${category.parent_id ? "Activity" : "Category"} ${category.is_active ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      console.error("Error toggling:", error);
      toast({
        title: "Error",
        description: "Failed to update",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (category: Category) => {
    try {
      const { error } = await supabase
        .from("activity_categories")
        .delete()
        .eq("id", category.id);

      if (error) throw error;

      // Also remove children if it's a parent
      if (!category.parent_id) {
        setCategories(prev => prev.filter(c => c.id !== category.id && c.parent_id !== category.id));
      } else {
        setCategories(prev => prev.filter(c => c.id !== category.id));
      }
      
      toast({ 
        title: "Success", 
        description: `${category.parent_id ? "Activity" : "Category"} deleted` 
      });
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Error",
        description: "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const activeCategory = categories.find(c => c.id === active.id);
    const overCategory = categories.find(c => c.id === over.id);
    
    if (!activeCategory || !overCategory) return;

    // Only allow reordering within the same level (both parents or both with same parent)
    if (activeCategory.parent_id !== overCategory.parent_id) return;

    const isParentLevel = activeCategory.parent_id === null;
    const relevantCategories = isParentLevel 
      ? parentCategories 
      : getChildren(activeCategory.parent_id!);

    const oldIndex = relevantCategories.findIndex(c => c.id === active.id);
    const newIndex = relevantCategories.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(relevantCategories, oldIndex, newIndex);
    
    // Update local state immediately for responsive UI
    const updatedCategories = categories.map(c => {
      const newPosition = newOrder.findIndex(item => item.id === c.id);
      if (newPosition !== -1) {
        return { ...c, sort_order: newPosition };
      }
      return c;
    });
    setCategories(updatedCategories);

    // Update database
    try {
      const updates = newOrder.map((cat, index) => 
        supabase
          .from("activity_categories")
          .update({ sort_order: index })
          .eq("id", cat.id)
      );
      
      await Promise.all(updates);
    } catch (error) {
      console.error("Error updating order:", error);
      // Revert on error
      fetchCategories();
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">About Activity Categories</p>
              <p className="text-blue-600 dark:text-blue-400">
                Organize activities into categories. Create a <strong>Category</strong> (e.g., "Classroom Activities") 
                and add <strong>Activities</strong> under it (e.g., "Lecture", "Lab Session"). 
                Drag items to reorder them. Only activities (not categories) can be selected in timesheets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Activity Categories</CardTitle>
            <CardDescription>
              Create categories and add activities under them
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAddCategoryDialog}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Create Category
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No categories found.</p>
              <p className="text-sm mt-1">
                Create a category to get started.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-2">
                {/* Parent Categories with their children */}
                <SortableContext 
                  items={parentCategories.map(c => c.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  {parentCategories.map((parent) => {
                    const children = getChildren(parent.id);
                    return (
                      <div key={parent.id} className="space-y-1">
                        <SortableCategoryItem
                          category={parent}
                          onToggleActive={handleToggleActive}
                          onDelete={handleDelete}
                          onAddActivity={openAddActivityDialog}
                          isParent={true}
                          childCount={children.length}
                        />
                        {/* Child activities */}
                        {children.length > 0 && (
                          <SortableContext 
                            items={children.map(c => c.id)} 
                            strategy={verticalListSortingStrategy}
                          >
                            {children.map((child) => (
                              <SortableCategoryItem
                                key={child.id}
                                category={child}
                                onToggleActive={handleToggleActive}
                                onDelete={handleDelete}
                                isParent={false}
                              />
                            ))}
                          </SortableContext>
                        )}
                      </div>
                    );
                  })}
                </SortableContext>

                {/* Orphan activities (those without hierarchy) */}
                {categories.filter(c => c.parent_id === null && !parentCategories.some(p => p.id === c.id)).length === 0 && 
                 categories.filter(c => c.parent_id !== null && !parentCategories.some(p => p.id === c.parent_id)).map((orphan) => (
                  <SortableCategoryItem
                    key={orphan.id}
                    category={orphan}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    isParent={false}
                  />
                ))}
              </div>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add Category/Activity Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "category" ? "Create New Category" : "Add Activity"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "category" 
                ? "Create a category to group related activities" 
                : `Add an activity under "${parentCategories.find(p => p.id === selectedParentId)?.name}"`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder={dialogMode === "category" ? "e.g., Classroom Activities" : "e.g., Lecture"}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder={dialogMode === "category" ? "e.g., All classroom-related work" : "e.g., Regular classroom teaching"}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "category" ? "Create Category" : "Add Activity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
