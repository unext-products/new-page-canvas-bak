import { useState, useEffect, useMemo, useRef } from "react";
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


export function useActivityCategories(_departmentId?: string | null) {
  const { userWithRole } = useAuth();
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!userWithRole || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    loadCategories();
  }, [userWithRole]);

  const loadCategories = async () => {
    if (!userWithRole) return;

    setLoading(true);
    try {
      // Get user's organization for filtering
      const { data: orgId } = await supabase.rpc("get_user_organization", {
        user_id: userWithRole.user.id,
      });

      let query = supabase
        .from("activity_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map data — no hardcoded fallback; empty means admin hasn't configured categories
      const categoriesWithCode: ActivityCategory[] = (data || []).map(cat => ({
        ...cat,
        code: cat.name.toLowerCase().replace(/\s+/g, '_'),
        parent_id: cat.parent_id || null,
        sort_order: cat.sort_order || 0,
      }));
      setCategories(categoriesWithCode);
    } catch (error) {
      console.error("Error loading categories:", error);
      setCategories([]);
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
