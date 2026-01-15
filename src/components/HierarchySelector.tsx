import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { VerticalSelect } from "./VerticalSelect";
import { ProgramSelect } from "./ProgramSelect";
import { BatchSelect } from "./BatchSelect";
import { TermSelect } from "./TermSelect";
import { SubjectSelect } from "./SubjectSelect";
import { useLabels } from "@/contexts/LabelContext";
import { supabase } from "@/integrations/supabase/client";

export interface HierarchySelection {
  verticalId: string;
  verticalCode?: string;
  programId: string;
  programCode?: string;
  batchId: string;
  batchName?: string;
  termId: string;
  termName?: string;
  subjectId: string;
  subjectCode?: string;
}

interface HierarchySelectorProps {
  value: HierarchySelection;
  onChange: (value: HierarchySelection) => void;
  disabled?: boolean;
  verticalIds?: string[]; // Filter verticals by these IDs (for user-assigned verticals)
  required?: {
    vertical?: boolean;
    program?: boolean;
    batch?: boolean;
    term?: boolean;
    subject?: boolean;
  };
  showLabels?: boolean;
}

export function HierarchySelector({
  value,
  onChange,
  disabled = false,
  verticalIds,
  required = { vertical: true },
  showLabels = true,
}: HierarchySelectorProps) {
  const { entityLabel } = useLabels();
  const [programVerticalId, setProgramVerticalId] = useState<string>("");

  // When vertical changes, fetch programs for that vertical
  useEffect(() => {
    if (value.verticalId && value.verticalId !== "all") {
      setProgramVerticalId(value.verticalId);
    } else {
      setProgramVerticalId("");
    }
  }, [value.verticalId]);

  const handleVerticalChange = async (verticalId: string) => {
    // Fetch vertical code
    let verticalCode = "";
    if (verticalId && verticalId !== "all") {
      const { data } = await supabase
        .from("verticals")
        .select("code")
        .eq("id", verticalId)
        .single();
      verticalCode = data?.code || "";
    }
    
    onChange({
      verticalId,
      verticalCode,
      programId: "",
      programCode: "",
      batchId: "",
      batchName: "",
      termId: "",
      termName: "",
      subjectId: "",
      subjectCode: "",
    });
  };

  const handleProgramChange = async (programId: string) => {
    let programCode = "";
    if (programId && programId !== "all") {
      const { data } = await supabase
        .from("programs")
        .select("code")
        .eq("id", programId)
        .single();
      programCode = data?.code || "";
    }

    onChange({
      ...value,
      programId,
      programCode,
      batchId: "",
      batchName: "",
      termId: "",
      termName: "",
      subjectId: "",
      subjectCode: "",
    });
  };

  const handleBatchChange = async (batchId: string) => {
    let batchName = "";
    if (batchId && batchId !== "all") {
      const { data } = await supabase
        .from("batches")
        .select("name")
        .eq("id", batchId)
        .single();
      batchName = data?.name || "";
    }

    onChange({
      ...value,
      batchId,
      batchName,
      termId: "",
      termName: "",
      subjectId: "",
      subjectCode: "",
    });
  };

  const handleTermChange = async (termId: string) => {
    let termName = "";
    if (termId && termId !== "all") {
      const { data } = await supabase
        .from("terms")
        .select("name")
        .eq("id", termId)
        .single();
      termName = data?.name || "";
    }

    onChange({
      ...value,
      termId,
      termName,
      subjectId: "",
      subjectCode: "",
    });
  };

  const handleSubjectChange = async (subjectId: string) => {
    let subjectCode = "";
    if (subjectId && subjectId !== "all") {
      const { data } = await supabase
        .from("subjects")
        .select("code")
        .eq("id", subjectId)
        .single();
      subjectCode = data?.code || "";
    }

    onChange({
      ...value,
      subjectId,
      subjectCode,
    });
  };

  return (
    <div className="space-y-4">
      {/* Vertical */}
      <div className="space-y-2">
        {showLabels && (
          <Label>
            {entityLabel("vertical")}
            {required?.vertical && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <VerticalSelect
          value={value.verticalId}
          onValueChange={handleVerticalChange}
          disabled={disabled}
          verticalIds={verticalIds}
        />
      </div>

      {/* Program */}
      <div className="space-y-2">
        {showLabels && (
          <Label>
            {entityLabel("program")}
            {required?.program && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <ProgramSelect
          value={value.programId}
          onValueChange={handleProgramChange}
          disabled={disabled || !value.verticalId}
          verticalId={programVerticalId}
        />
      </div>

      {/* Batch */}
      <div className="space-y-2">
        {showLabels && (
          <Label>
            {entityLabel("batch")}
            {required?.batch && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <BatchSelect
          value={value.batchId}
          onValueChange={handleBatchChange}
          programId={value.programId}
          disabled={disabled || !value.programId}
        />
      </div>

      {/* Term */}
      <div className="space-y-2">
        {showLabels && (
          <Label>
            {entityLabel("term")}
            {required?.term && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <TermSelect
          value={value.termId}
          onValueChange={handleTermChange}
          batchId={value.batchId}
          disabled={disabled || !value.batchId}
        />
      </div>

      {/* Subject */}
      <div className="space-y-2">
        {showLabels && (
          <Label>
            {entityLabel("subject")}
            {required?.subject && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <SubjectSelect
          value={value.subjectId}
          onValueChange={handleSubjectChange}
          termId={value.termId}
          disabled={disabled || !value.termId}
        />
      </div>
    </div>
  );
}
