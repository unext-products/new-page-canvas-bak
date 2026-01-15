import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Layers3, Plus, Pencil, Trash2, Users, CalendarDays } from "lucide-react";
import { z } from "zod";
import { VerticalSelect } from "@/components/VerticalSelect";
import { ProgramSelect } from "@/components/ProgramSelect";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

const batchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  program_id: z.string().uuid("Please select a program"),
});

interface Batch {
  id: string;
  name: string;
  program_id: string;
  created_at: string;
  termCount?: number;
  userCount?: number;
  programs?: {
    name: string;
    code: string;
    verticals?: { name: string };
  };
}

export default function Batches() {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState({ name: "", program_id: "", vertical_id: "" });

  useEffect(() => {
    if (!userWithRole) return;
    if (!["org_admin", "program_manager"].includes(userWithRole.role || "")) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [userWithRole, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: batchesData, error: batchesError } = await supabase
        .from("batches")
        .select("*, programs(name, code, verticals(name))")
        .order("name");

      if (batchesError) throw batchesError;

      // Fetch term counts
      const { data: termsData, error: termsError } = await supabase
        .from("terms")
        .select("batch_id");

      if (termsError) throw termsError;

      // Fetch user batch assignments
      const { data: userBatches, error: userBatchesError } = await supabase
        .from("user_batches")
        .select("batch_id");

      if (userBatchesError) throw userBatchesError;

      // Count terms per batch
      const termCounts = termsData?.reduce((acc, term) => {
        acc[term.batch_id] = (acc[term.batch_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Count users per batch
      const userCounts = userBatches?.reduce((acc, ub) => {
        acc[ub.batch_id] = (acc[ub.batch_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const batchesWithCounts = batchesData?.map(batch => ({
        ...batch,
        termCount: termCounts[batch.id] || 0,
        userCount: userCounts[batch.id] || 0,
      })) || [];

      setBatches(batchesWithCounts);
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
      const validated = batchSchema.parse(formData);
      const { error } = await supabase
        .from("batches")
        .insert([{ name: validated.name, program_id: validated.program_id }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("batch")} created successfully`,
      });
      setDialogOpen(false);
      setFormData({ name: "", program_id: "", vertical_id: "" });
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
    if (!selectedBatch) return;

    try {
      const validated = batchSchema.parse(formData);
      const { error } = await supabase
        .from("batches")
        .update({ name: validated.name, program_id: validated.program_id })
        .eq("id", selectedBatch.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("batch")} updated successfully`,
      });
      setDialogOpen(false);
      setSelectedBatch(null);
      setFormData({ name: "", program_id: "", vertical_id: "" });
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
    if (!selectedBatch) return;

    try {
      const { error } = await supabase
        .from("batches")
        .delete()
        .eq("id", selectedBatch.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${entityLabel("batch")} deleted successfully`,
      });
      setDeleteDialogOpen(false);
      setSelectedBatch(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (batch: Batch) => {
    setSelectedBatch(batch);
    // Need to fetch vertical_id from program
    supabase
      .from("programs")
      .select("vertical_id")
      .eq("id", batch.program_id)
      .single()
      .then(({ data }) => {
        setFormData({
          name: batch.name,
          program_id: batch.program_id,
          vertical_id: data?.vertical_id || "",
        });
        setDialogOpen(true);
      });
  };

  const openDeleteDialog = (batch: Batch) => {
    setSelectedBatch(batch);
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
          title={entityLabel("batch", true)}
          description={`Manage ${entityLabel("batch", true).toLowerCase()} within ${entityLabel("program", true).toLowerCase()}`}
          icon={Layers3}
          actions={
            <Button onClick={() => {
              setSelectedBatch(null);
              setFormData({ name: "", program_id: "", vertical_id: "" });
              setDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add {entityLabel("batch")}
            </Button>
          }
        />

        {batches.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Layers3}
                title={`No ${entityLabel("batch", true).toLowerCase()} yet`}
                description={`Create your first ${entityLabel("batch").toLowerCase()} to get started`}
                action={{
                  label: `Add ${entityLabel("batch")}`,
                  onClick: () => setDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <Card key={batch.id} variant="interactive">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Layers3 className="h-8 w-8 text-primary" />
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(batch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(batch)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle>{batch.name}</CardTitle>
                  <CardDescription>
                    {entityLabel("program")}: {batch.programs?.name || "N/A"}
                    <br />
                    {entityLabel("vertical")}: {batch.programs?.verticals?.name || "N/A"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{batch.termCount} {batch.termCount === 1 ? entityLabel("term").toLowerCase() : entityLabel("term", true).toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{batch.userCount} {batch.userCount === 1 ? 'user' : 'users'}</span>
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
              <DialogTitle>{selectedBatch ? "Edit" : "Create"} {entityLabel("batch")}</DialogTitle>
              <DialogDescription>
                {selectedBatch ? `Update the ${entityLabel("batch").toLowerCase()} details` : `Add a new ${entityLabel("batch").toLowerCase()}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{entityLabel("vertical")}</Label>
                <VerticalSelect
                  value={formData.vertical_id}
                  onValueChange={(value) => setFormData({ ...formData, vertical_id: value, program_id: "" })}
                />
              </div>
              <div className="space-y-2">
                <Label>{entityLabel("program")}</Label>
                <ProgramSelect
                  value={formData.program_id}
                  onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                  verticalId={formData.vertical_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{entityLabel("batch")} Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Batch 1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={selectedBatch ? handleEdit : handleCreate} disabled={!formData.name || !formData.program_id}>
                {selectedBatch ? "Update" : "Create"}
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
                This will permanently delete the {entityLabel("batch").toLowerCase()} "{selectedBatch?.name}" and all its {entityLabel("term", true).toLowerCase()} and {entityLabel("subject", true).toLowerCase()}. This action cannot be undone.
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
