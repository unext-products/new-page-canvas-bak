import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityCategory {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  department_id: string | null;
  organization_id: string;
}

export function useActivityCategories(departmentId?: string | null) {
  const { userWithRole } = useAuth();
  const [categories, setCategories] = useState<ActivityCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userWithRole) return;
    
    loadCategories();
  }, [userWithRole, departmentId]);

  const loadCategories = async () => {
    if (!userWithRole) return;

    setLoading(true);
    try {
      // Fetch all categories for the organization
      const { data, error } = await supabase
        .from("activity_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // If departmentId is provided, check for department-specific categories
        const deptCategories = departmentId 
          ? data.filter(c => c.department_id === departmentId)
          : [];
        
        // If there are department-specific categories, use those; otherwise use org-wide
        const effectiveCategories = deptCategories.length > 0 
          ? deptCategories 
          : data.filter(c => c.department_id === null);

        setCategories(effectiveCategories);
      } else {
        // Fallback to hardcoded defaults if no categories exist
        setCategories([
          { id: "1", name: "Class", code: "class", description: "Teaching/lecture sessions", is_active: true, display_order: 1, department_id: null, organization_id: "" },
          { id: "2", name: "Quiz", code: "quiz", description: "Quizzes and assessments", is_active: true, display_order: 2, department_id: null, organization_id: "" },
          { id: "3", name: "Invigilation", code: "invigilation", description: "Exam invigilation/proctoring", is_active: true, display_order: 3, department_id: null, organization_id: "" },
          { id: "4", name: "Admin", code: "admin", description: "Administrative tasks", is_active: true, display_order: 4, department_id: null, organization_id: "" },
          { id: "5", name: "Other", code: "other", description: "Miscellaneous activities", is_active: true, display_order: 5, department_id: null, organization_id: "" },
        ]);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
      // Fallback to defaults on error
      setCategories([
        { id: "1", name: "Class", code: "class", description: null, is_active: true, display_order: 1, department_id: null, organization_id: "" },
        { id: "2", name: "Quiz", code: "quiz", description: null, is_active: true, display_order: 2, department_id: null, organization_id: "" },
        { id: "3", name: "Invigilation", code: "invigilation", description: null, is_active: true, display_order: 3, department_id: null, organization_id: "" },
        { id: "4", name: "Admin", code: "admin", description: null, is_active: true, display_order: 4, department_id: null, organization_id: "" },
        { id: "5", name: "Other", code: "other", description: null, is_active: true, display_order: 5, department_id: null, organization_id: "" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, refetch: loadCategories };
}
