import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Match the actual database schema for activity_categories
// Note: 'code' is derived from 'name' for backward compatibility with code that expects it
export interface ActivityCategory {
  id: string;
  name: string;
  code: string; // Derived from name for backwards compatibility
  description: string | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
}

// Helper to create a category with code derived from name
const createCategory = (
  id: string,
  name: string,
  description: string | null
): ActivityCategory => ({
  id,
  name,
  code: name.toLowerCase().replace(/\s+/g, '_'),
  description,
  is_active: true,
  organization_id: null,
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
        .order("name", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Add code property derived from name for backwards compatibility
        const categoriesWithCode: ActivityCategory[] = data.map(cat => ({
          ...cat,
          code: cat.name.toLowerCase().replace(/\s+/g, '_'),
        }));
        setCategories(categoriesWithCode);
      } else {
        // Fallback to hardcoded defaults if no categories exist
        setCategories([
          createCategory("1", "Class", "Teaching/lecture sessions"),
          createCategory("2", "Quiz", "Quizzes and assessments"),
          createCategory("3", "Invigilation", "Exam invigilation/proctoring"),
          createCategory("4", "Admin", "Administrative tasks"),
          createCategory("5", "Other", "Miscellaneous activities"),
        ]);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      // Fallback to defaults on error
      setCategories([
        createCategory("1", "Class", null),
        createCategory("2", "Quiz", null),
        createCategory("3", "Invigilation", null),
        createCategory("4", "Admin", null),
        createCategory("5", "Other", null),
      ]);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, refetch: loadCategories };
}
