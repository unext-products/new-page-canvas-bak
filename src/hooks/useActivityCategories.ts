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

// Helper to create a category with explicit code (for fallbacks matching DB enum)
const createCategoryWithCode = (
  id: string,
  name: string,
  code: string,
  description: string | null
): ActivityCategory => ({
  id,
  name,
  code,
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

  return { categories, loading, refetch: loadCategories };
}
