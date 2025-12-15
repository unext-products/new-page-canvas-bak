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
import { Plus, Pencil, UserX, UserCheck, Search, Eye, EyeOff, Trash2, Users as UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { UserRoleSelect } from "@/components/UserRoleSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DepartmentMultiSelect } from "@/components/DepartmentMultiSelect";
import { ProgramSelect } from "@/components/ProgramSelect";
import { ProgramMultiSelect } from "@/components/ProgramMultiSelect";
import { userCreateSchema, type UserCreateInput } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import type { UserRole } from "@/lib/supabase";
import { displayToDbRole, toDisplayRole, type DbRole } from "@/lib/roleMapping";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

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
    department_id: "",
    department_ids: [] as string[],
    program_id: "",
    program_ids: [] as string[],
    is_active: true,
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!loading && (!userWithRole || userWithRole.role !== "org_admin")) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole?.role === "org_admin") {
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

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("id, name");

      if (deptError) throw deptError;

      // Fetch auth users for emails using edge function
      const { data: authResponse, error: authError } = await supabase.functions.invoke('admin-list-users');

      if (authError) throw authError;
      
      const authUsers = authResponse?.users || [];

      // Create lookup maps
      const rolesMap = new Map<string, any>();
      rolesData?.forEach(r => rolesMap.set(r.user_id, r));
      
      const deptMap = new Map<string, string>();
      deptData?.forEach(d => deptMap.set(d.id, d.name));
      
      const emailMap = new Map<string, string>();
      authUsers.forEach((u: any) => u.email && emailMap.set(u.id, u.email));

      const enrichedUsers: UserProfile[] = profilesData?.map(profile => {
        const roleData = rolesMap.get(profile.id);
        return {
          ...profile,
          email: emailMap.get(profile.id) || undefined,
          role: toDisplayRole(roleData?.role as DbRole) || null,
          department_id: roleData?.department_id || null,
          department_name: roleData?.department_id ? deptMap.get(roleData.department_id) || null : null,
          program_id: roleData?.program_id || null,
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

  const handleCreate = async () => {
    try {
      // Validate form data
      const validatedData = userCreateSchema.parse({
        ...formData,
        phone: formData.phone || undefined,
        department_id: formData.department_ids[0] || formData.department_id || undefined,
        program_id: formData.program_ids[0] || formData.program_id || undefined,
      });

      // Call edge function to create user - convert display role to DB role
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          ...validatedData,
          role: displayToDbRole[validatedData.role],
          department_ids: formData.department_ids.length > 0 ? formData.department_ids : undefined,
          program_ids: formData.program_ids.length > 0 ? formData.program_ids : undefined,
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
        program_id: "",
        program_ids: [],
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
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert(
            {
              user_id: selectedUser.id,
              role: displayToDbRole[formData.role],
              department_id: formData.role === "org_admin" ? null : formData.department_id || null,
              program_id: (formData.role === "program_manager" || formData.role === "member") ? formData.program_id || null : null,
            },
            {
              onConflict: 'user_id'
            }
          );

        if (roleError) throw roleError;
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
        program_id: "",
        program_ids: [],
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
    setFormData({
      full_name: user.full_name,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      department_id: user.department_id || "",
      department_ids: user.department_id ? [user.department_id] : [],
      program_id: user.program_id || "",
      program_ids: user.program_id ? [user.program_id] : [],
      is_active: user.is_active,
      password: "",
      confirmPassword: "",
    });
    setEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: UserRole | null) => {
    switch (role) {
      case "org_admin":
        return "destructive";
      case "program_manager":
        return "default";
      case "manager":
        return "default";
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
                      setFormData({ ...formData, role: value as UserRole, department_id: "", program_id: "" });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="department">
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
                    <Label htmlFor="program">
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
                    ((formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && formData.department_ids.length === 0 && !formData.department_id) ||
                    (formData.role === "program_manager" && !formData.program_id)
                  }
                >
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <SelectItem value="program_manager">{roleLabel("program_manager")}</SelectItem>
              <SelectItem value="manager">{roleLabel("manager")}</SelectItem>
              <SelectItem value="member">{roleLabel("member")}</SelectItem>
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
                <TableHead>Department</TableHead>
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
                      <span className="font-medium">{user.full_name}</span>
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
                  <TableCell>{user.department_name || "-"}</TableCell>
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
                  Department {(formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && "*"}
                </Label>
                <DepartmentSelect
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value, program_id: "" })}
                  disabled={formData.role === "org_admin"}
                />
                {formData.role === "org_admin" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Not required for Organization Admin role
                  </p>
                )}
                {(formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && !formData.department_id && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for this role
                  </p>
                )}
              </div>

              {(formData.role === "program_manager" || formData.role === "member") && (
                <div>
                  <Label htmlFor="edit-program">
                    Program {formData.role === "program_manager" && "*"}
                  </Label>
                  <ProgramSelect
                    value={formData.program_id}
                    onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                    departmentId={formData.department_id}
                    disabled={!formData.department_id}
                  />
                  {formData.role === "program_manager" && !formData.program_id && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Required for Program Manager role
                    </p>
                  )}
                  {formData.role === "member" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Optional for Member role
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
                  ((formData.role === "manager" || formData.role === "member" || formData.role === "program_manager") && !formData.department_id) ||
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
