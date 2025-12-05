import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface OrganizationLabels {
  role_org_admin: string;
  role_program_manager: string;
  role_manager: string;
  role_member: string;
  entity_department: string;
  entity_department_plural: string;
  entity_program: string;
  entity_program_plural: string;
}

const defaultLabels: OrganizationLabels = {
  role_org_admin: "Organization Admin",
  role_program_manager: "Program Manager",
  role_manager: "Manager",
  role_member: "Member",
  entity_department: "Department",
  entity_department_plural: "Departments",
  entity_program: "Program",
  entity_program_plural: "Programs",
};

interface LabelContextType {
  labels: OrganizationLabels;
  isLoading: boolean;
  roleLabel: (role: string) => string;
  entityLabel: (entity: "department" | "program", plural?: boolean) => string;
  refetchLabels: () => Promise<void>;
}

const LabelContext = createContext<LabelContextType | undefined>(undefined);

export function LabelProvider({ children }: { children: ReactNode }) {
  const { userWithRole } = useAuth();
  const [labels, setLabels] = useState<OrganizationLabels>(defaultLabels);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLabels = async () => {
    if (!userWithRole?.user?.id) {
      setLabels(defaultLabels);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("organization_labels")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Error fetching labels:", error);
        setLabels(defaultLabels);
      } else if (data) {
        setLabels({
          role_org_admin: data.role_org_admin,
          role_program_manager: data.role_program_manager,
          role_manager: data.role_manager,
          role_member: data.role_member,
          entity_department: data.entity_department,
          entity_department_plural: data.entity_department_plural,
          entity_program: data.entity_program,
          entity_program_plural: data.entity_program_plural,
        });
      } else {
        setLabels(defaultLabels);
      }
    } catch (error) {
      console.error("Error fetching labels:", error);
      setLabels(defaultLabels);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabels();
  }, [userWithRole?.user?.id]);

  const roleLabel = (role: string): string => {
    switch (role) {
      case "org_admin":
        return labels.role_org_admin;
      case "program_manager":
        return labels.role_program_manager;
      case "manager":
        return labels.role_manager;
      case "member":
        return labels.role_member;
      default:
        return role;
    }
  };

  const entityLabel = (entity: "department" | "program", plural = false): string => {
    if (entity === "department") {
      return plural ? labels.entity_department_plural : labels.entity_department;
    }
    return plural ? labels.entity_program_plural : labels.entity_program;
  };

  return (
    <LabelContext.Provider value={{ labels, isLoading, roleLabel, entityLabel, refetchLabels: fetchLabels }}>
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
