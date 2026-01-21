import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Match the actual database schema for activity_categories
export interface ActivityCategory {
  id: string;
  name: string;
  code: string; // Derived from name for backwards compatibility
  description: string | null;
  is_active: boolean;
  organization_id: string | null;
  parent_id: string | null; // For 2-level hierarchy
  sort_order: number; // For ordering
  created_at: string;
}

// Helper to create a category with explicit code (for fallbacks matching DB enum)
const createCategoryWithCode = (
  id: string,
  name: string,
  code: string,
  description: string | null,
  parentId: string | null = null,
  sortOrder: number = 0
): ActivityCategory => ({
  id,
  name,
  code,
  description,
  is_active: true,
  organization_id: null,
  parent_id: parentId,
  sort_order: sortOrder,
  created_at: new Date().toISOString(),
});

export function useActivityCategories(_departmentId?: string | null) {
  const { userWithRole } = useAuth();
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userWithRole) return;
    
    loadCategories();
  }, [userWithRole]);

  const loadCategories = async () => {
    if (!userWithRole) return;

    setLoading(true);
    try {
      // Fetch all active categories for the organization
      const { data, error } = await supabase
        .from("activity_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Add code property derived from name for backwards compatibility
        const categoriesWithCode: ActivityCategory[] = data.map(cat => ({
          ...cat,
          code: cat.name.toLowerCase().replace(/\s+/g, '_'),
          parent_id: cat.parent_id || null,
          sort_order: cat.sort_order || 0,
        }));
        setCategories(categoriesWithCode);
      } else {
        // Fallback to hardcoded defaults with correct DB enum codes
        setCategories([
          createCategoryWithCode("1", "Class", "class", "Teaching/lecture sessions"),
          createCategoryWithCode("2", "Quiz", "quiz", "Quizzes and assessments"),
          createCategoryWithCode("3", "Invigilation", "invigilation", "Exam invigilation/proctoring"),
          createCategoryWithCode("4", "Admin", "admin", "Administrative tasks"),
          createCategoryWithCode("5", "Non-Academic", "other", "Non-academic activities"),
        ]);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      // Fallback to defaults on error
      setCategories([
        createCategoryWithCode("1", "Class", "class", null),
        createCategoryWithCode("2", "Quiz", "quiz", null),
        createCategoryWithCode("3", "Invigilation", "invigilation", null),
        createCategoryWithCode("4", "Admin", "admin", null),
        createCategoryWithCode("5", "Non-Academic", "other", null),
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Get parent categories (those without parent_id)
  const parentCategories = useMemo(() => {
    return categories.filter(c => c.parent_id === null);
  }, [categories]);

  // Get child activities (those with parent_id)
  const childActivities = useMemo(() => {
    return categories.filter(c => c.parent_id !== null);
  }, [categories]);

  // Get children for a specific parent
  const getChildren = (parentId: string) => {
    return childActivities.filter(c => c.parent_id === parentId);
  };

  // Check if hierarchy is being used (any category has children)
  const hasHierarchy = useMemo(() => {
    return childActivities.length > 0;
  }, [childActivities]);

  // Get selectable activities (leaf nodes - either child activities or parents without children)
  const selectableActivities = useMemo(() => {
    if (!hasHierarchy) {
      // No hierarchy - all categories are selectable
      return categories;
    }
    // With hierarchy - only child activities are selectable
    return childActivities;
  }, [categories, childActivities, hasHierarchy]);

  return { 
    categories, 
    loading, 
    refetch: loadCategories,
    parentCategories,
    childActivities,
    getChildren,
    hasHierarchy,
    selectableActivities,
  };
}
