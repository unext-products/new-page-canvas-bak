import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, UserX, UserCheck, Search, Eye, EyeOff, Trash2, Users as UsersIcon, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { UserRoleSelect } from "@/components/UserRoleSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DepartmentMultiSelect } from "@/components/DepartmentMultiSelect";
import { ProgramSelect } from "@/components/ProgramSelect";
import { ProgramMultiSelect } from "@/components/ProgramMultiSelect";
import { VerticalMultiSelect } from "@/components/VerticalMultiSelect";
import { VerticalSelect } from "@/components/VerticalSelect";
import { userCreateSchema, type UserCreateInput } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import type { UserRole } from "@/lib/supabase";
import { displayToDbRole, toDisplayRole, type DbRole } from "@/lib/roleMapping";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { calculateDurationMinutes } from "@/lib/timesheetUtils";
import { format, startOfWeek, endOfWeek } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  email?: string | undefined;
  role?: UserRole | null;
  department_id?: string | null;
  department_name?: string | null;
  program_id?: string | null;
  departments: { id: string; name: string }[];
  programs: { id: string; name: string }[];
}

export default function Users() {
  const { userWithRole, loading } = useAuth();
  const { roleLabel, entityLabel } = useLabels();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "" as UserRole | "",
    // Legacy department fields (for backward compatibility)
    department_id: "",
    department_ids: [] as string[],
    // New hierarchy fields
    vertical_ids: [] as string[],
    program_ids: [] as string[],
    batch_ids: [] as string[],
    subject_ids: [] as string[],
    // Legacy program field
    program_id: "",
    is_active: true,
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  
  // User detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState({ logged: 0, target: 40 });
  
  // Download dialog state
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadFilters, setDownloadFilters] = useState({
    vertical_id: "all",
    role: "all"
  });

  useEffect(() => {
    // Allow org_admin and super_admin to access
    const isAdmin = userWithRole?.role === "org_admin" || userWithRole?.role === "admin" || userWithRole?.role === "super_admin";
    if (!loading && (!userWithRole || !isAdmin)) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    const isAdmin = userWithRole?.role === "org_admin" || userWithRole?.role === "admin" || userWithRole?.role === "super_admin";
    if (isAdmin) {
      fetchUsers();
    }
  }, [userWithRole]);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, roleFilter, users]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, department_id, program_id");

      if (rolesError) throw rolesError;

      // Fetch departments (legacy)
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("id, name");

      if (deptError) throw deptError;

      // Fetch verticals (new)
      const { data: verticalsData, error: verticalsError } = await supabase
        .from("verticals")
        .select("id, name");

      if (verticalsError) throw verticalsError;

      // Fetch programs
      const { data: programData, error: programError } = await supabase
        .from("programs")
        .select("id, name");

      if (programError) throw programError;

      // Fetch user_departments junction table (legacy)
      const { data: userDeptData, error: userDeptError } = await supabase
        .from("user_departments")
        .select("user_id, department_id");

      if (userDeptError) throw userDeptError;

      // Fetch user_verticals junction table (new - preferred)
      const { data: userVertData, error: userVertError } = await supabase
        .from("user_verticals")
        .select("user_id, vertical_id");

      if (userVertError) throw userVertError;

      // Fetch user_programs junction table
      const { data: userProgramData, error: userProgramError } = await supabase
        .from("user_programs")
        .select("user_id, program_id");

      if (userProgramError) throw userProgramError;

      // Fetch auth users for emails using edge function
      const { data: authResponse, error: authError } = await supabase.functions.invoke('admin-list-users');

      if (authError) throw authError;
      
      const authUsers = authResponse?.users || [];

      // Create lookup maps
      const rolesMap = new Map<string, any>();
      rolesData?.forEach(r => rolesMap.set(r.user_id, r));
      
      const deptMap = new Map<string, string>();
      deptData?.forEach(d => deptMap.set(d.id, d.name));

      const verticalMap = new Map<string, string>();
      verticalsData?.forEach(v => verticalMap.set(v.id, v.name));

      const programMap = new Map<string, string>();
      programData?.forEach(p => programMap.set(p.id, p.name));
      
      const emailMap = new Map<string, string>();
      authUsers.forEach((u: any) => u.email && emailMap.set(u.id, u.email));

      // Build user -> verticals mapping (preferred over departments for display)
      const userVerticalsMap = new Map<string, { id: string; name: string }[]>();
      userVertData?.forEach(uv => {
        const verts = userVerticalsMap.get(uv.user_id) || [];
        const vertName = verticalMap.get(uv.vertical_id);
        if (vertName) {
          verts.push({ id: uv.vertical_id, name: vertName });
        }
        userVerticalsMap.set(uv.user_id, verts);
      });

      // Build user -> departments mapping (legacy fallback)
      const userDeptsMap = new Map<string, { id: string; name: string }[]>();
      userDeptData?.forEach(ud => {
        const depts = userDeptsMap.get(ud.user_id) || [];
        const deptName = deptMap.get(ud.department_id);
        if (deptName) {
          depts.push({ id: ud.department_id, name: deptName });
        }
        userDeptsMap.set(ud.user_id, depts);
      });

      // Build user -> programs mapping
      const userProgramsMap = new Map<string, { id: string; name: string }[]>();
      userProgramData?.forEach(up => {
        const programs = userProgramsMap.get(up.user_id) || [];
        const programName = programMap.get(up.program_id);
        if (programName) {
          programs.push({ id: up.program_id, name: programName });
        }
        userProgramsMap.set(up.user_id, programs);
      });

      const enrichedUsers: UserProfile[] = profilesData?.map(profile => {
        const roleData = rolesMap.get(profile.id);
        
        // Prefer user_verticals over user_departments for display
        let userDepts = userVerticalsMap.get(profile.id) || [];
        
        // Fallback to legacy user_departments if no verticals assigned
        if (userDepts.length === 0) {
          userDepts = userDeptsMap.get(profile.id) || [];
        }
        
        const userProgs = userProgramsMap.get(profile.id) || [];
        
        // If still no entries, fall back to user_roles data
        if (userDepts.length === 0 && roleData?.department_id) {
          const deptName = deptMap.get(roleData.department_id);
          if (deptName) {
            userDepts.push({ id: roleData.department_id, name: deptName });
          }
        }
        if (userProgs.length === 0 && roleData?.program_id) {
          const progName = programMap.get(roleData.program_id);
          if (progName) {
            userProgs.push({ id: roleData.program_id, name: progName });
          }
        }

        return {
          ...profile,
          email: emailMap.get(profile.id) || undefined,
          role: toDisplayRole(roleData?.role as DbRole) || null,
          department_id: roleData?.department_id || null,
          department_name: roleData?.department_id ? deptMap.get(roleData.department_id) || null : null,
          program_id: roleData?.program_id || null,
          departments: userDepts,
          programs: userProgs,
        };
      }) || [];

      setUsers(enrichedUsers);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "fetch users"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  // Open user detail dialog
  const openDetailDialog = async (user: UserProfile) => {
    setDetailUser(user);
    setDetailDialogOpen(true);
    
    // Fetch weekly timesheet data for this user
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
    
    try {
      const { data: entries } = await supabase
        .from("timesheet_entries")
        .select("start_time, end_time")
        .eq("user_id", user.id)
        .gte("entry_date", format(weekStart, "yyyy-MM-dd"))
        .lte("entry_date", format(weekEnd, "yyyy-MM-dd"));
      
      // Calculate total minutes and convert to hours
      const totalMinutes = entries?.reduce((sum, e) => 
        sum + calculateDurationMinutes(e.start_time, e.end_time), 0) || 0;
      
      setWeeklyProgress({ logged: totalMinutes / 60, target: 40 });
    } catch (error) {
      console.error("Error fetching weekly progress:", error);
      setWeeklyProgress({ logged: 0, target: 40 });
    }
  };

  // Get filtered users for download
  const getFilteredUsersForDownload = () => {
    let filtered = users;
    
    if (downloadFilters.vertical_id !== "all") {
      filtered = filtered.filter(user => 
        user.departments.some(d => d.id === downloadFilters.vertical_id)
      );
    }
    
    if (downloadFilters.role !== "all") {
      filtered = filtered.filter(user => user.role === downloadFilters.role);
    }
    
    return filtered;
  };

  // Export to CSV
  const exportUsersToCSV = () => {
    const usersToExport = getFilteredUsersForDownload();
    const headers = ["Name", "Email", "Role", entityLabel("vertical", true), "Status"];
    const rows = usersToExport.map(user => [
      user.full_name,
      user.email || "",
      roleLabel(user.role || ""),
      user.departments.map(d => d.name).join(", ") || "-",
      user.is_active ? "Active" : "Inactive"
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `users_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    
    setDownloadDialogOpen(false);
    toast({
      title: "Success",
      description: `Exported ${usersToExport.length} users to CSV`,
    });
  };

  // Export to PDF
  const exportUsersToPDF = () => {
    const usersToExport = getFilteredUsersForDownload();
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("User List", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 32);
    doc.text(`Total Users: ${usersToExport.length}`, 14, 38);
    
    autoTable(doc, {
      startY: 48,
      head: [["Name", "Email", "Role", entityLabel("vertical", true), "Status"]],
      body: usersToExport.map(user => [
        user.full_name,
        user.email || "",
        roleLabel(user.role || ""),
        user.departments.map(d => d.name).join(", ") || "-",
        user.is_active ? "Active" : "Inactive"
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
    });
    
    // Add footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }
    
    doc.save(`users_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    setDownloadDialogOpen(false);
    toast({
      title: "Success",
      description: `Exported ${usersToExport.length} users to PDF`,
    });
  };

  const handleCreate = async () => {
    try {
      // Validate form data
      const validatedData = userCreateSchema.parse({
        ...formData,
        phone: formData.phone || undefined,
        department_id: formData.department_ids[0] || formData.department_id || undefined,
        program_id: formData.program_ids[0] || formData.program_id || undefined,
      });

      // Call edge function to create user - pass hierarchy data
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          full_name: validatedData.full_name,
          email: validatedData.email,
          phone: validatedData.phone,
          password: validatedData.password,
          is_active: formData.is_active,
          role: displayToDbRole[validatedData.role],
          // New hierarchy fields
          vertical_ids: formData.vertical_ids.length > 0 ? formData.vertical_ids : undefined,
          program_ids: formData.program_ids.length > 0 ? formData.program_ids : undefined,
          batch_ids: formData.batch_ids.length > 0 ? formData.batch_ids : undefined,
          subject_ids: formData.subject_ids.length > 0 ? formData.subject_ids : undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "User created successfully. You can now share the login credentials with the user.",
      });

      setCreateDialogOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "",
        department_id: "",
        department_ids: [],
        vertical_ids: [],
        program_ids: [],
        batch_ids: [],
        subject_ids: [],
        program_id: "",
        is_active: true,
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchUsers();
    } catch (error: any) {
      // If it's a Zod validation error, show the specific validation message
      if (error.errors) {
        toast({
          title: "Validation Error",
          description: error.errors[0]?.message || "Invalid input",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: getUserErrorMessage(error, "create user"),
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          is_active: formData.is_active,
        })
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Update or insert user role
      if (formData.role) {
        const deptIds = formData.department_ids.length > 0 ? formData.department_ids : (formData.department_id ? [formData.department_id] : []);
        const progIds = formData.program_ids.length > 0 ? formData.program_ids : (formData.program_id ? [formData.program_id] : []);
        
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            {
              user_id: selectedUser.id,
              role: displayToDbRole[formData.role],
              department_id: formData.role === "org_admin" ? null : deptIds[0] || null,
              program_id: (formData.role === "program_manager" || formData.role === "member") ? progIds[0] || null : null,
            },
            {
              onConflict: 'user_id'
            }
          );

        if (roleError) throw roleError;

        // Sync user_departments junction table
        if (formData.role !== "org_admin" && deptIds.length > 0) {
          // Delete existing department assignments
          const { error: deleteDeptError } = await supabase
            .from("user_departments")
            .delete()
            .eq("user_id", selectedUser.id);
          
          if (deleteDeptError) throw deleteDeptError;

          // Insert new department assignments
          const deptInserts = deptIds.map(dept_id => ({
            user_id: selectedUser.id,
            department_id: dept_id,
          }));
          
          const { error: insertDeptError } = await supabase
            .from("user_departments")
            .insert(deptInserts);
          
          if (insertDeptError) throw insertDeptError;
        } else if (formData.role === "org_admin") {
          // Clear department assignments for org_admin
          await supabase
            .from("user_departments")
            .delete()
            .eq("user_id", selectedUser.id);
        }

        // Sync user_programs junction table
        if ((formData.role === "program_manager" || formData.role === "member") && progIds.length > 0) {
          // Delete existing program assignments
          const { error: deleteProgError } = await supabase
            .from("user_programs")
            .delete()
            .eq("user_id", selectedUser.id);
          
          if (deleteProgError) throw deleteProgError;

          // Insert new program assignments
          const progInserts = progIds.map(prog_id => ({
            user_id: selectedUser.id,
            program_id: prog_id,
          }));
          
          const { error: insertProgError } = await supabase
            .from("user_programs")
            .insert(progInserts);
          
          if (insertProgError) throw insertProgError;
        } else if (formData.role === "org_admin" || formData.role === "manager") {
          // Clear program assignments for roles that don't need them
          await supabase
            .from("user_programs")
            .delete()
            .eq("user_id", selectedUser.id);
        }
      }

      // Update password if provided
      if (formData.password && formData.password.trim() !== "") {
        // Validate password
        if (formData.password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
        
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
          throw new Error("Password must contain uppercase, lowercase, and number");
        }
        
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match");
        }

        // Call edge function to update password securely
        const { data, error: passwordError } = await supabase.functions.invoke(
          'admin-update-user',
          {
            body: {
              user_id: selectedUser.id,
              password: formData.password,
            },
          }
        );

        if (passwordError) throw passwordError;
        if (data?.error) throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: formData.password && formData.password.trim() !== "" ? 
          "User updated successfully. New password has been set." :
          "User updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "" as UserRole | "",
        department_id: "",
        department_ids: [],
        vertical_ids: [],
        program_ids: [],
        batch_ids: [],
        subject_ids: [],
        program_id: "",
        is_active: true,
        password: "",
        confirmPassword: "",
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (user: UserProfile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !user.is_active })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${user.is_active ? 'deactivated' : 'activated'} successfully`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "update user status"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      // Call edge function to delete user
      const { data, error } = await supabase.functions.invoke(
        'admin-delete-user',
        {
          body: {
            user_id: userToDelete.id,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: `User "${userToDelete.full_name}" has been deleted successfully`,
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserErrorMessage(error, "delete user"),
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (user: UserProfile) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    // Load all departments and programs from junction tables
    const deptIds = user.departments.map(d => d.id);
    const progIds = user.programs.map(p => p.id);
    
    setFormData({
      full_name: user.full_name,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      department_id: deptIds[0] || user.department_id || "",
      department_ids: deptIds.length > 0 ? deptIds : (user.department_id ? [user.department_id] : []),
      vertical_ids: [], // TODO: Load from user_verticals
      program_ids: progIds.length > 0 ? progIds : (user.program_id ? [user.program_id] : []),
      batch_ids: [], // TODO: Load from user_batches
      subject_ids: [], // TODO: Load from user_subjects
      program_id: progIds[0] || user.program_id || "",
      is_active: user.is_active,
      password: "",
      confirmPassword: "",
    });
    setEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: UserRole | null) => {
    switch (role) {
      case "org_admin":
      case "admin":
      case "super_admin":
        return "destructive";
      case "l3":
      case "manager":
        return "default";
      case "l2":
      case "program_manager":
        return "default";
      case "l1":
      case "member":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <PageSkeleton type="table" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
              <p className="text-sm text-muted-foreground">Manage users, roles, and permissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Download Button */}
            <Button variant="outline" onClick={() => setDownloadDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            
            {/* Add User Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                  <DialogDescription>Add a new user to the system</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone (Optional)</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Minimum 8 characters"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {formData.password && formData.password.length > 0 && formData.password.length < 8 && (
                      <p className="text-sm text-destructive mt-1">Password must be at least 8 characters</p>
                    )}
                    {formData.password && formData.password.length >= 8 && 
                     !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password) && (
                      <p className="text-sm text-destructive mt-1">
                        Must contain uppercase, lowercase, and number
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-sm text-destructive mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <div>
                    <Label>Role</Label>
                    <UserRoleSelect
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData({ 
                          ...formData, 
                          role: value as UserRole, 
                          vertical_ids: [],
                          program_ids: [],
                          batch_ids: [],
                          subject_ids: [],
                        });
                      }}
                    />
                  </div>
                  
                  {/* Vertical assignment for L3, L2, and L1 */}
                  {(formData.role === "l3" || formData.role === "l2" || formData.role === "l1") && (
                    <div>
                      <Label htmlFor="vertical">
                        {entityLabel("vertical", true)} *
                      </Label>
                      <VerticalMultiSelect
                        value={formData.vertical_ids}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          vertical_ids: value, 
                          program_ids: [], 
                          batch_ids: [],
                          subject_ids: [],
                        })}
                      />
                      {formData.vertical_ids.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Required for {roleLabel(formData.role)} role
                        </p>
                      )}
                    </div>
                  )}

                  {/* Program assignment for L2 and L1 */}
                  {(formData.role === "l2" || formData.role === "l1") && formData.vertical_ids.length > 0 && (
                    <div>
                      <Label htmlFor="program">
                        {entityLabel("program", true)} {formData.role === "l1" ? "*" : "(optional)"}
                      </Label>
                      <ProgramMultiSelect
                        value={formData.program_ids}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          program_ids: value,
                          batch_ids: [],
                          subject_ids: [],
                        })}
                        verticalIds={formData.vertical_ids}
                        disabled={formData.vertical_ids.length === 0}
                      />
                      {formData.role === "l1" && formData.program_ids.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Required for {roleLabel("l1")} role
                        </p>
                      )}
                    </div>
                  )}

                  {/* Note about L1 full hierarchy - simplified for now */}
                  {formData.role === "l1" && (
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      <p><strong>Note:</strong> {roleLabel("l1")} users require assignment to verticals, programs, batches, and subjects. Additional hierarchy levels can be configured after user creation.</p>
                    </div>
                  )}

                  {formData.role === "org_admin" && (
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      <p>{roleLabel("org_admin")} has full access to the organization. No vertical assignment required.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Active</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      !formData.full_name || 
                      !formData.email || 
                      !formData.role ||
                      !formData.password ||
                      formData.password.length < 8 ||
                      formData.password !== formData.confirmPassword ||
                      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password) ||
                      // L3, L2, L1 require vertical assignment
                      ((formData.role === "l3" || formData.role === "l2" || formData.role === "l1") && formData.vertical_ids.length === 0) ||
                      // L1 requires program assignment
                      (formData.role === "l1" && formData.program_ids.length === 0)
                    }
                  >
                    Create User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="org_admin">{roleLabel("org_admin")}</SelectItem>
              <SelectItem value="l3">{roleLabel("l3")}</SelectItem>
              <SelectItem value="l2">{roleLabel("l2")}</SelectItem>
              <SelectItem value="l1">{roleLabel("l1")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>{entityLabel("vertical")}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>{user.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span 
                        className="font-medium cursor-pointer hover:underline text-primary"
                        onClick={() => openDetailDialog(user)}
                      >
                        {user.full_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.role ? (
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {roleLabel(user.role)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No role</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.departments.length === 0 ? (
                      "-"
                    ) : user.departments.length === 1 ? (
                      user.departments[0].name
                    ) : (
                      <span title={user.departments.map(d => d.name).join(", ")}>
                        {user.departments[0].name} <Badge variant="secondary" className="ml-1 text-xs">+{user.departments.length - 1}</Badge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "secondary"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleUserStatus(user)}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(user)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* User Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            {detailUser && (
              <div className="space-y-6">
                {/* User Info Section */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={detailUser.avatar_url || undefined} />
                    <AvatarFallback className="text-xl">
                      {detailUser.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{detailUser.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{detailUser.email}</p>
                    {detailUser.phone && <p className="text-sm">{detailUser.phone}</p>}
                  </div>
                </div>
                
                {/* Role & Status */}
                <div className="flex gap-2">
                  {detailUser.role && (
                    <Badge variant={getRoleBadgeVariant(detailUser.role)}>
                      {roleLabel(detailUser.role)}
                    </Badge>
                  )}
                  <Badge variant={detailUser.is_active ? "default" : "secondary"}>
                    {detailUser.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                
                {/* Departments/Verticals */}
                <div>
                  <Label className="text-muted-foreground">Assigned {entityLabel("vertical", true)}</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {detailUser.departments.map(d => (
                      <Badge key={d.id} variant="outline">{d.name}</Badge>
                    ))}
                    {detailUser.departments.length === 0 && (
                      <span className="text-muted-foreground text-sm">None assigned</span>
                    )}
                  </div>
                </div>

                {/* Programs */}
                {detailUser.programs.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Assigned {entityLabel("program", true)}</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {detailUser.programs.map(p => (
                        <Badge key={p.id} variant="outline">{p.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Weekly Progress */}
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-muted-foreground">Weekly Progress</Label>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold">
                      {((weeklyProgress.logged / weeklyProgress.target) * 100).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">
                      {weeklyProgress.logged.toFixed(1)} of {weeklyProgress.target.toFixed(1)} hours
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((weeklyProgress.logged / weeklyProgress.target) * 100, 100)} 
                    className="mt-2" 
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Download Dialog */}
        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download User List</DialogTitle>
              <DialogDescription>Optional: Apply filters before download</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Vertical Filter */}
              <div>
                <Label>{entityLabel("vertical")}</Label>
                <VerticalSelect
                  value={downloadFilters.vertical_id}
                  onValueChange={(v) => setDownloadFilters({...downloadFilters, vertical_id: v})}
                  includeAll={true}
                />
              </div>
              
              {/* Role Filter */}
              <div>
                <Label>Role</Label>
                <Select 
                  value={downloadFilters.role} 
                  onValueChange={(v) => setDownloadFilters({...downloadFilters, role: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="org_admin">{roleLabel("org_admin")}</SelectItem>
                    <SelectItem value="l3">{roleLabel("l3")}</SelectItem>
                    <SelectItem value="l2">{roleLabel("l2")}</SelectItem>
                    <SelectItem value="l1">{roleLabel("l1")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {getFilteredUsersForDownload().length} users will be exported
              </p>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={exportUsersToCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
              <Button onClick={exportUsersToPDF}>
                <FileText className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div>
                <Label htmlFor="edit-full_name">Full Name</Label>
                <Input
                  id="edit-full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Email cannot be changed (used for login)
                </p>
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-password">New Password (Optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {formData.password && formData.password.length > 0 && formData.password.length < 8 && (
                  <p className="text-sm text-destructive mt-1">Password must be at least 8 characters</p>
                )}
                {formData.password && formData.password.length >= 8 && 
                 !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password) && (
                  <p className="text-sm text-destructive mt-1">
                    Must contain uppercase, lowercase, and number
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="edit-confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="edit-confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    disabled={!formData.password}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={!formData.password}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {formData.password && formData.confirmPassword && 
                 formData.password !== formData.confirmPassword && (
                  <p className="text-sm text-destructive mt-1">Passwords do not match</p>
                )}
              </div>

              <div>
                <Label>Role</Label>
                <UserRoleSelect
                  value={formData.role}
                  onValueChange={(value) => {
                    setFormData({ ...formData, role: value as UserRole, department_id: "", program_id: "" });
                  }}
                />
              </div>

              <div>
                <Label>
                  {entityLabel("department", true)} {(formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && "*"}
                </Label>
                {(formData.role === "member" || formData.role === "manager") ? (
                  <DepartmentMultiSelect
                    value={formData.department_ids}
                    onValueChange={(value) => setFormData({ ...formData, department_ids: value, department_id: value[0] || "", program_ids: [], program_id: "" })}
                    disabled={false}
                  />
                ) : (
                  <DepartmentSelect
                    value={formData.department_id}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value, department_ids: value ? [value] : [], program_id: "", program_ids: [] })}
                    disabled={formData.role === "org_admin"}
                  />
                )}
                {formData.role === "org_admin" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Not required for Organization Admin role
                  </p>
                )}
                {(formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && formData.department_ids.length === 0 && !formData.department_id && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for this role
                  </p>
                )}
              </div>

              {(formData.role === "program_manager" || formData.role === "member") && (
                <div>
                  <Label htmlFor="edit-program">
                    {entityLabel("program", true)} {formData.role === "program_manager" && "*"}
                  </Label>
                  {formData.role === "member" ? (
                    <ProgramMultiSelect
                      value={formData.program_ids}
                      onValueChange={(value) => setFormData({ ...formData, program_ids: value, program_id: value[0] || "" })}
                      departmentIds={formData.department_ids.length > 0 ? formData.department_ids : (formData.department_id ? [formData.department_id] : [])}
                      disabled={formData.department_ids.length === 0 && !formData.department_id}
                    />
                  ) : (
                    <ProgramSelect
                      value={formData.program_id}
                      onValueChange={(value) => setFormData({ ...formData, program_id: value, program_ids: value ? [value] : [] })}
                      departmentId={formData.department_id}
                      disabled={!formData.department_id}
                    />
                  )}
                  {formData.role === "program_manager" && !formData.program_id && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Required for Program Manager role
                    </p>
                  )}
                  {formData.role === "member" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Optional for {roleLabel("member")} role
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is_active">Active</Label>
                <Switch
                  id="edit-is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEdit}
                disabled={
                  !formData.full_name ||
                  !formData.role ||
                  (formData.password && formData.password.length > 0 && (
                    formData.password.length < 8 ||
                    formData.password !== formData.confirmPassword ||
                    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)
                  )) ||
                  ((formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && formData.department_ids.length === 0 && !formData.department_id) ||
                  (formData.role === "program_manager" && !formData.program_id)
                }
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the user "{userToDelete?.full_name}" ({userToDelete?.email})?
                <br /><br />
                <span className="font-semibold text-destructive">
                  This action cannot be undone. This will permanently delete:
                </span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>User account and authentication</li>
                  <li>User profile information</li>
                  <li>All timesheet entries created by this user</li>
                  <li>All leave records</li>
                  <li>User role assignments</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
