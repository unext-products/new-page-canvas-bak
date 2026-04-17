import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { isRole } from "@/lib/roleMapping";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, Plus, Pencil, Trash2, Users, Download } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { VerticalSelect } from "@/components/VerticalSelect";
import { ProgramSelect } from "@/components/ProgramSelect";
import { BatchSelect } from "@/components/BatchSelect";
import { TermSelect } from "@/components/TermSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const subjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9 _-]+$/, "Code must be uppercase letters, numbers, spaces, underscores, or hyphens"),
  term_id: z.string().uuid("Please select a term"),
});

interface Subject {
  id: string;
  name: string;
  code: string;
  term_id: string;
  created_at: string;
  userCount?: number;
  terms?: {
    name: string;
    batches?: {
      name: string;
      programs?: {
        name: string;
        code: string;
        verticals?: { name: string };
      };
    };
  };
}

export default function Subjects() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", term_id: "", batch_id: "", program_id: "", vertical_id: "" });
  const [filterVerticalId, setFilterVerticalId] = useState<string>("all");
  const [filterProgramId, setFilterProgramId] = useState<string>("all");
  const [filterBatchId, setFilterBatchId] = useState<string>("all");
  const [filterTermId, setFilterTermId] = useState<string>("all");

  // Store lookups for filtering
  const [termBatchLookup, setTermBatchLookup] = useState<Map<string, string>>(new Map());
  const [batchProgramLookup, setBatchProgramLookup] = useState<Map<string, string>>(new Map());
  const [programVerticalLookup, setProgramVerticalLookup] = useState<Map<string, string>>(new Map());

  // Helper: treat "all"/"" as no filter
  const isActive = (v: string) => !!v && v !== "all";

  // Filter subjects based on selected filters
  const filteredSubjects = subjects.filter(subject => {
    // Filter by term
    if (isActive(filterTermId) && subject.term_id !== filterTermId) return false;
    // Filter by batch (through term)
    if (isActive(filterBatchId) && !isActive(filterTermId)) {
      const termBatchId = termBatchLookup.get(subject.term_id);
      if (termBatchId !== filterBatchId) return false;
    }
    // Filter by program (through term -> batch)
    if (isActive(filterProgramId) && !isActive(filterBatchId) && !isActive(filterTermId)) {
      const termBatchId = termBatchLookup.get(subject.term_id);
      if (!termBatchId) return false;
      const batchProgramId = batchProgramLookup.get(termBatchId);
      if (batchProgramId !== filterProgramId) return false;
    }
    // Filter by vertical (through term -> batch -> program)
    if (isActive(filterVerticalId) && !isActive(filterProgramId) && !isActive(filterBatchId) && !isActive(filterTermId)) {
      const termBatchId = termBatchLookup.get(subject.term_id);
      if (!termBatchId) return false;
      const batchProgramId = batchProgramLookup.get(termBatchId);
      if (!batchProgramId) return false;
      const programVerticalId = programVerticalLookup.get(batchProgramId);
      if (programVerticalId !== filterVerticalId) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!userWithRole) return;
    if (!isRole(userWithRole.role, "admin", "org_admin", "super_admin", "l3", "l2")) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [userWithRole, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch programs for vertical lookup
      const { data: programsData } = await supabase
        .from("programs")
        .select("id, vertical_id");
      
      const pvLookup = new Map<string, string>();
      programsData?.forEach(p => {
        if (p.vertical_id) pvLookup.set(p.id, p.vertical_id);
      });
      setProgramVerticalLookup(pvLookup);
      
      // Fetch batches for program lookup
      const { data: batchesForLookup } = await supabase
        .from("batches")
        .select("id, program_id");
      
      const bpLookup = new Map<string, string>();
      batchesForLookup?.forEach(b => {
        bpLookup.set(b.id, b.program_id);
      });
      setBatchProgramLookup(bpLookup);
      
      // Fetch terms for batch lookup
      const { data: termsForLookup } = await supabase
        .from("terms")
        .select("id, batch_id");
      
      const tbLookup = new Map<string, string>();
      termsForLookup?.forEach(t => {
        tbLookup.set(t.id, t.batch_id);
      });
      setTermBatchLookup(tbLookup);
      
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("*, terms(name, batches(name, programs(name, code, verticals(name))))")
        .order("code");

      if (subjectsError) throw subjectsError;

      // Fetch user subject assignments
      const { data: userSubjects, error: userSubjectsError } = await supabase
        .from("user_subjects")
        .select("subject_id");

      if (userSubjectsError) throw userSubjectsError;

      // Count users per subject
      const userCounts = userSubjects?.reduce((acc, us) => {
        acc[us.subject_id] = (acc[us.subject_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const subjectsWithCounts = subjectsData?.map(subject => ({
        ...subject,
        userCount: userCounts[subject.id] || 0,
      })) || [];

      setSubjects(subjectsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const validated = subjectSchema.parse(formData);
      const { error } = await supabase
        .from("subjects")
        .insert([{ name: validated.name, code: validated.code.toUpperCase(), term_id: validated.term_id }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("subject")} created successfully`,
      });
      setDialogOpen(false);
      setFormData({ name: "", code: "", term_id: "", batch_id: "", program_id: "", vertical_id: "" });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = async () => {
    if (!selectedSubject) return;

    try {
      const validated = subjectSchema.parse(formData);
      const { error } = await supabase
        .from("subjects")
        .update({ name: validated.name, code: validated.code.toUpperCase(), term_id: validated.term_id })
        .eq("id", selectedSubject.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("subject")} updated successfully`,
      });
      setDialogOpen(false);
      setSelectedSubject(null);
      setFormData({ name: "", code: "", term_id: "", batch_id: "", program_id: "", vertical_id: "" });
      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedSubject) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", selectedSubject.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("subject")} deleted successfully`,
      });
      setDeleteDialogOpen(false);
      setSelectedSubject(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = async (subject: Subject) => {
    setSelectedSubject(subject);
    // Fetch the full hierarchy IDs
    const { data: termData } = await supabase
      .from("terms")
      .select("batch_id, batches(program_id, programs(vertical_id))")
      .eq("id", subject.term_id)
      .single();

    setFormData({
      name: subject.name,
      code: subject.code,
      term_id: subject.term_id,
      batch_id: termData?.batch_id || "",
      program_id: termData?.batches?.program_id || "",
      vertical_id: termData?.batches?.programs?.vertical_id || "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (subject: Subject) => {
    setSelectedSubject(subject);
    setDeleteDialogOpen(true);
  };

  if (!userWithRole || loading) {
    return (
      <Layout>
        <PageSkeleton type="cards" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title={entityLabel("subject", true)}
          description={`Manage ${entityLabel("subject", true).toLowerCase()} within ${entityLabel("term", true).toLowerCase()}`}
          icon={BookOpen}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => {
                const headers = ["Name", "Code", "Term", "Batch", "Program", "Vertical", "Users Count"];
                const rows = filteredSubjects.map(s => [s.name, s.code, s.terms?.name || "N/A", s.terms?.batches?.name || "N/A", s.terms?.batches?.programs?.name || "N/A", s.terms?.batches?.programs?.verticals?.name || "N/A", s.userCount || 0]);
                const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `subjects_${format(new Date(), "yyyy-MM-dd")}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button onClick={() => {
                setSelectedSubject(null);
                setFormData({ name: "", code: "", term_id: "", batch_id: "", program_id: "", vertical_id: "" });
                setDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add {entityLabel("subject")}
              </Button>
            </div>
          }
        />

        {/* Filter Section */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{entityLabel("vertical")}:</Label>
              <VerticalSelect
                value={filterVerticalId}
                onValueChange={(value) => {
                  setFilterVerticalId(value);
                  setFilterProgramId("all");
                  setFilterBatchId("all");
                  setFilterTermId("all");
                }}
                includeAll
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{entityLabel("program")}:</Label>
              <ProgramSelect
                value={filterProgramId}
                onValueChange={(value) => {
                  setFilterProgramId(value);
                  setFilterBatchId("all");
                  setFilterTermId("all");
                }}
                verticalId={filterVerticalId}
                includeAll
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{entityLabel("batch")}:</Label>
              <BatchSelect
                value={filterBatchId}
                onValueChange={(value) => {
                  setFilterBatchId(value);
                  setFilterTermId("all");
                }}
                programId={filterProgramId}
                includeAll
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{entityLabel("term")}:</Label>
              <TermSelect
                value={filterTermId}
                onValueChange={setFilterTermId}
                batchId={filterBatchId}
                includeAll
              />
            </div>
          </div>
        </Card>

        {filteredSubjects.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={BookOpen}
                title={`No ${entityLabel("subject", true).toLowerCase()} ${isActive(filterVerticalId) || isActive(filterProgramId) || isActive(filterBatchId) || isActive(filterTermId) ? "matching filters" : "yet"}`}
                description={isActive(filterVerticalId) || isActive(filterProgramId) || isActive(filterBatchId) || isActive(filterTermId) ? `No ${entityLabel("subject", true).toLowerCase()} found for the selected filters` : `Create your first ${entityLabel("subject").toLowerCase()} to get started`}
                action={!isActive(filterVerticalId) && !isActive(filterProgramId) && !isActive(filterBatchId) && !isActive(filterTermId) ? {
                  label: `Add ${entityLabel("subject")}`,
                  onClick: () => setDialogOpen(true)
                } : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSubjects.map((subject) => (
              <Card key={subject.id} variant="interactive">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <BookOpen className="h-8 w-8 text-primary" />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(subject)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(subject)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{subject.name}</CardTitle>
                  <CardDescription className="font-mono">{subject.code}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{entityLabel("term")}: {subject.terms?.name || "N/A"}</p>
                    <p>{entityLabel("batch")}: {subject.terms?.batches?.name || "N/A"}</p>
                    <p>{entityLabel("program")}: {subject.terms?.batches?.programs?.name || "N/A"}</p>
                    <div className="flex items-center gap-2 pt-2">
                      <Users className="h-4 w-4" />
                      <span>{subject.userCount} {subject.userCount === 1 ? 'user' : 'users'} assigned</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedSubject ? "Edit" : "Create"} {entityLabel("subject")}</DialogTitle>
              <DialogDescription>
                {selectedSubject ? `Update the ${entityLabel("subject").toLowerCase()} details` : `Add a new ${entityLabel("subject").toLowerCase()}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{entityLabel("vertical")}</Label>
                <VerticalSelect
                  value={formData.vertical_id}
                  onValueChange={(value) => setFormData({ ...formData, vertical_id: value, program_id: "", batch_id: "", term_id: "" })}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("program")}</Label>
                <ProgramSelect
                  value={formData.program_id}
                  onValueChange={(value) => setFormData({ ...formData, program_id: value, batch_id: "", term_id: "" })}
                  verticalId={formData.vertical_id}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("batch")}</Label>
                <BatchSelect
                  value={formData.batch_id}
                  onValueChange={(value) => setFormData({ ...formData, batch_id: value, term_id: "" })}
                  programId={formData.program_id}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("term")}</Label>
                <TermSelect
                  value={formData.term_id}
                  onValueChange={(value) => setFormData({ ...formData, term_id: value })}
                  batchId={formData.batch_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{entityLabel("subject")} Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Retail Banking Solutions"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">{entityLabel("subject")} Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., DBS 601"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={selectedSubject ? handleEdit : handleCreate} disabled={!formData.name || !formData.code || !formData.term_id}>
                {selectedSubject ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the {entityLabel("subject").toLowerCase()} "{selectedSubject?.name}" ({selectedSubject?.code}). This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
