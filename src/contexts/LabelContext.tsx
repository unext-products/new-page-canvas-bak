import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface OrganizationLabels {
  // Entity labels
  entity_department: string;
  entity_department_plural: string;
  entity_program: string;
  entity_program_plural: string;
  entity_vertical: string;
  entity_vertical_plural: string;
  entity_batch: string;
  entity_batch_plural: string;
  entity_term: string;
  entity_term_plural: string;
  entity_subject: string;
  entity_subject_plural: string;
}

export interface RoleLabels {
  role_super_admin: string;
  role_admin: string;
  role_l3: string;
  role_l2: string;
  role_l1: string;
}

const defaultLabels: OrganizationLabels = {
  entity_department: "Department",
  entity_department_plural: "Departments",
  entity_program: "Program",
  entity_program_plural: "Programs",
  entity_vertical: "Vertical",
  entity_vertical_plural: "Verticals",
  entity_batch: "Batch",
  entity_batch_plural: "Batches",
  entity_term: "Term",
  entity_term_plural: "Terms",
  entity_subject: "Subject",
  entity_subject_plural: "Subjects",
};

const defaultRoleLabels: RoleLabels = {
  role_super_admin: "Super Admin",
  role_admin: "Admin",
  role_l3: "L3",
  role_l2: "L2",
  role_l1: "L1",
};

type EntityType = "department" | "program" | "vertical" | "batch" | "term" | "subject";

interface LabelContextType {
  labels: OrganizationLabels;
  roleLabels: RoleLabels;
  isLoading: boolean;
  roleLabel: (role: string) => string;
  entityLabel: (entity: EntityType, plural?: boolean) => string;
  refetchLabels: () => Promise<void>;
}

const LabelContext = createContext<LabelContextType | undefined>(undefined);

export function LabelProvider({ children }: { children: ReactNode }) {
  const { userWithRole } = useAuth();
  const [labels, setLabels] = useState<OrganizationLabels>(defaultLabels);
  const [roleLabels, setRoleLabels] = useState<RoleLabels>(defaultRoleLabels);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLabels = async () => {
    if (!userWithRole?.user?.id) {
      setLabels(defaultLabels);
      setRoleLabels(defaultRoleLabels);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch entity labels
      const { data: entityData, error: entityError } = await supabase
        .from("organization_labels")
        .select("*")
        .maybeSingle();

      if (entityError) {
        console.error("Error fetching entity labels:", entityError);
      } else if (entityData) {
        setLabels({
          entity_department: entityData.entity_department || defaultLabels.entity_department,
          entity_department_plural: entityData.entity_department_plural || defaultLabels.entity_department_plural,
          entity_program: entityData.entity_program || defaultLabels.entity_program,
          entity_program_plural: entityData.entity_program_plural || defaultLabels.entity_program_plural,
          entity_vertical: entityData.entity_vertical || defaultLabels.entity_vertical,
          entity_vertical_plural: entityData.entity_vertical_plural || defaultLabels.entity_vertical_plural,
          entity_batch: entityData.entity_batch || defaultLabels.entity_batch,
          entity_batch_plural: entityData.entity_batch_plural || defaultLabels.entity_batch_plural,
          entity_term: entityData.entity_term || defaultLabels.entity_term,
          entity_term_plural: entityData.entity_term_plural || defaultLabels.entity_term_plural,
          entity_subject: entityData.entity_subject || defaultLabels.entity_subject,
          entity_subject_plural: entityData.entity_subject_plural || defaultLabels.entity_subject_plural,
        });
      }

      // Fetch role labels from organization_role_labels table
      const { data: roleData, error: roleError } = await supabase
        .from("organization_role_labels")
        .select("*")
        .maybeSingle();

      if (roleError) {
        console.error("Error fetching role labels:", roleError);
      } else if (roleData) {
        setRoleLabels({
          role_super_admin: roleData.role_super_admin || defaultRoleLabels.role_super_admin,
          role_admin: roleData.role_admin || defaultRoleLabels.role_admin,
          role_l3: roleData.role_l3 || defaultRoleLabels.role_l3,
          role_l2: roleData.role_l2 || defaultRoleLabels.role_l2,
          role_l1: roleData.role_l1 || defaultRoleLabels.role_l1,
        });
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      setLabels(defaultLabels);
      setRoleLabels(defaultRoleLabels);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabels();
  }, [userWithRole?.user?.id]);

  const roleLabel = (role: string): string => {
    // Map DB roles to display labels
    switch (role) {
      case "super_admin":
        return roleLabels.role_super_admin;
      case "org_admin":
      case "admin":
        return roleLabels.role_admin;
      case "l3":
      case "hod":
      case "manager":
        return roleLabels.role_l3;
      case "l2":
      case "program_manager":
        return roleLabels.role_l2;
      case "l1":
      case "faculty":
      case "member":
        return roleLabels.role_l1;
      default:
        return role;
    }
  };

  const entityLabel = (entity: EntityType, plural = false): string => {
    switch (entity) {
      case "department":
        return plural ? labels.entity_department_plural : labels.entity_department;
      case "program":
        return plural ? labels.entity_program_plural : labels.entity_program;
      case "vertical":
        return plural ? labels.entity_vertical_plural : labels.entity_vertical;
      case "batch":
        return plural ? labels.entity_batch_plural : labels.entity_batch;
      case "term":
        return plural ? labels.entity_term_plural : labels.entity_term;
      case "subject":
        return plural ? labels.entity_subject_plural : labels.entity_subject;
      default:
        return entity;
    }
  };

  return (
    <LabelContext.Provider value={{ labels, roleLabels, isLoading, roleLabel, entityLabel, refetchLabels: fetchLabels }}>
      {children}
    </LabelContext.Provider>
  );
}

export function useLabels() {
  const context = useContext(LabelContext);
  if (context === undefined) {
    throw new Error("useLabels must be used within a LabelProvider");
  }
  return context;
}
