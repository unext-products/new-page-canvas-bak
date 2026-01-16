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
import { Calendar, Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { z } from "zod";
import { VerticalSelect } from "@/components/VerticalSelect";
import { ProgramSelect } from "@/components/ProgramSelect";
import { BatchSelect } from "@/components/BatchSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const termSchema = z.object({
  name: z.string().min(1, "Name is required"),
  batch_id: z.string().uuid("Please select a batch"),
});

interface Term {
  id: string;
  name: string;
  batch_id: string;
  created_at: string;
  subjectCount?: number;
  batches?: {
    name: string;
    programs?: {
      name: string;
      code: string;
      verticals?: { name: string };
    };
  };
}

export default function Terms() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [formData, setFormData] = useState({ name: "", batch_id: "", program_id: "", vertical_id: "" });

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
      
      const { data: termsData, error: termsError } = await supabase
        .from("terms")
        .select("*, batches(name, programs(name, code, verticals(name)))")
        .order("name");

      if (termsError) throw termsError;

      // Fetch subject counts
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("term_id");

      if (subjectsError) throw subjectsError;

      // Count subjects per term
      const subjectCounts = subjectsData?.reduce((acc, subject) => {
        acc[subject.term_id] = (acc[subject.term_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const termsWithCounts = termsData?.map(term => ({
        ...term,
        subjectCount: subjectCounts[term.id] || 0,
      })) || [];

      setTerms(termsWithCounts);
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
      const validated = termSchema.parse(formData);
      const { error } = await supabase
        .from("terms")
        .insert([{ name: validated.name, batch_id: validated.batch_id }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("term")} created successfully`,
      });
      setDialogOpen(false);
      setFormData({ name: "", batch_id: "", program_id: "", vertical_id: "" });
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
    if (!selectedTerm) return;

    try {
      const validated = termSchema.parse(formData);
      const { error } = await supabase
        .from("terms")
        .update({ name: validated.name, batch_id: validated.batch_id })
        .eq("id", selectedTerm.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("term")} updated successfully`,
      });
      setDialogOpen(false);
      setSelectedTerm(null);
      setFormData({ name: "", batch_id: "", program_id: "", vertical_id: "" });
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
    if (!selectedTerm) return;

    try {
      const { error } = await supabase
        .from("terms")
        .delete()
        .eq("id", selectedTerm.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("term")} deleted successfully`,
      });
      setDeleteDialogOpen(false);
      setSelectedTerm(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = async (term: Term) => {
    setSelectedTerm(term);
    // Need to fetch program_id and vertical_id from batch
    const { data: batchData } = await supabase
      .from("batches")
      .select("program_id, programs(vertical_id)")
      .eq("id", term.batch_id)
      .single();

    setFormData({
      name: term.name,
      batch_id: term.batch_id,
      program_id: batchData?.program_id || "",
      vertical_id: batchData?.programs?.vertical_id || "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (term: Term) => {
    setSelectedTerm(term);
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
          title={entityLabel("term", true)}
          description={`Manage ${entityLabel("term", true).toLowerCase()} within ${entityLabel("batch", true).toLowerCase()}`}
          icon={Calendar}
          actions={
            <Button onClick={() => {
              setSelectedTerm(null);
              setFormData({ name: "", batch_id: "", program_id: "", vertical_id: "" });
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add {entityLabel("term")}
            </Button>
          }
        />

        {terms.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Calendar}
                title={`No ${entityLabel("term", true).toLowerCase()} yet`}
                description={`Create your first ${entityLabel("term").toLowerCase()} to get started`}
                action={{
                  label: `Add ${entityLabel("term")}`,
                  onClick: () => setDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {terms.map((term) => (
              <Card key={term.id} variant="interactive">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(term)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(term)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle>{term.name}</CardTitle>
                  <CardDescription>
                    {entityLabel("batch")}: {term.batches?.name || "N/A"}
                    <br />
                    {entityLabel("program")}: {term.batches?.programs?.name || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{term.subjectCount} {term.subjectCount === 1 ? entityLabel("subject").toLowerCase() : entityLabel("subject", true).toLowerCase()}</span>
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
              <DialogTitle>{selectedTerm ? "Edit" : "Create"} {entityLabel("term")}</DialogTitle>
              <DialogDescription>
                {selectedTerm ? `Update the ${entityLabel("term").toLowerCase()} details` : `Add a new ${entityLabel("term").toLowerCase()}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{entityLabel("vertical")}</Label>
                <VerticalSelect
                  value={formData.vertical_id}
                  onValueChange={(value) => setFormData({ ...formData, vertical_id: value, program_id: "", batch_id: "" })}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("program")}</Label>
                <ProgramSelect
                  value={formData.program_id}
                  onValueChange={(value) => setFormData({ ...formData, program_id: value, batch_id: "" })}
                  verticalId={formData.vertical_id}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("batch")}</Label>
                <BatchSelect
                  value={formData.batch_id}
                  onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                  programId={formData.program_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{entityLabel("term")} Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Term 1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={selectedTerm ? handleEdit : handleCreate} disabled={!formData.name || !formData.batch_id}>
                {selectedTerm ? "Update" : "Create"}
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
                This will permanently delete the {entityLabel("term").toLowerCase()} "{selectedTerm?.name}" and all its {entityLabel("subject", true).toLowerCase()}. This action cannot be undone.
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
