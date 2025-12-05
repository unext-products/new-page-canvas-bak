import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { Loader2, Plus, Trash2, GripVertical, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Category {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  department_id: string | null;
  organization_id: string;
}

interface Department {
  id: string;
  name: string;
}

export default function CategorySettings() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedScope, setSelectedScope] = useState<"organization" | string>("organization");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // New category form
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const isOrgAdmin = userWithRole?.role === "org_admin";
  const isHod = userWithRole?.role === "manager";

  useEffect(() => {
    if (isOrgAdmin) {
      fetchDepartments();
    } else if (isHod && userWithRole?.departmentId) {
      setSelectedScope(userWithRole.departmentId);
    }
    fetchCategories();
  }, [userWithRole]);

  useEffect(() => {
    fetchCategories();
  }, [selectedScope]);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setDepartments(data);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("activity_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (selectedScope === "organization") {
        query = query.is("department_id", null);
      } else {
        query = query.eq("department_id", selectedScope);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCategories(data || []);
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

  const handleAddCategory = async () => {
    if (!newName.trim() || !newCode.trim()) {
      toast({
        title: "Error",
        description: "Name and code are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Get organization_id
      const { data: orgData } = await supabase.rpc("get_user_organization", {
        user_id: userWithRole?.user.id,
      });

      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order)) + 1 
        : 1;

      const { error } = await supabase.from("activity_categories").insert({
        organization_id: orgData,
        department_id: selectedScope === "organization" ? null : selectedScope,
        name: newName.trim(),
        code: newCode.trim().toLowerCase().replace(/\s+/g, "_"),
        description: newDescription.trim() || null,
        display_order: maxOrder,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Category added" });
      setDialogOpen(false);
      setNewName("");
      setNewCode("");
      setNewDescription("");
      fetchCategories();
    } catch (error: any) {
      console.error("Error adding category:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add category",
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
        description: `Category ${category.is_active ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      console.error("Error toggling category:", error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    try {
      const { error } = await supabase
        .from("activity_categories")
        .delete()
        .eq("id", category.id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== category.id));
      toast({ title: "Success", description: "Category deleted" });
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
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
                Activity categories define the types of work members can log in their timesheets.
                {isOrgAdmin && " Organization-wide categories apply to all departments. Department-specific categories override the defaults for that department only."}
                {isHod && " You can customize categories for your department only."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scope Selector - Only for Org Admin */}
      {isOrgAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Scope</CardTitle>
            <CardDescription>
              Choose whether to manage organization-wide categories or department-specific ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedScope} onValueChange={setSelectedScope}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization-wide (Default)</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {entityLabel("department")}: {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Activity Categories</CardTitle>
            <CardDescription>
              {selectedScope === "organization" 
                ? "These categories are available to all departments"
                : `Categories specific to this ${entityLabel("department").toLowerCase()}`}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Category</DialogTitle>
                <DialogDescription>
                  Create a new activity category for timesheets
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Lab Session"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., lab_session"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Internal identifier (lowercase, no spaces)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="e.g., Practical/hands-on work"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCategory} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No categories found.</p>
              {selectedScope !== "organization" && (
                <p className="text-sm mt-1">
                  This {entityLabel("department").toLowerCase()} will use organization-wide categories.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{category.name}</p>
                    {category.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => handleToggleActive(category)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{category.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCategory(category)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
