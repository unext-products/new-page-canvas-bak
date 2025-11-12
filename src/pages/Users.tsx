import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, UserX, UserCheck, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserRoleSelect } from "@/components/UserRoleSelect";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { userCreateSchema, type UserCreateInput } from "@/lib/validation";
import { getUserErrorMessage } from "@/lib/errorHandler";
import type { UserRole } from "@/lib/supabase";

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
}

export default function Users() {
  const { userWithRole, loading } = useAuth();
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
    is_active: true,
  });

  useEffect(() => {
    if (!loading && (!userWithRole || userWithRole.role !== "admin")) {
      navigate("/dashboard");
    }
  }, [userWithRole, loading, navigate]);

  useEffect(() => {
    if (userWithRole?.role === "admin") {
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
        .select("user_id, role, department_id");

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
          role: roleData?.role || null,
          department_id: roleData?.department_id || null,
          department_name: roleData?.department_id ? deptMap.get(roleData.department_id) || null : null,
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
      const validatedData = userCreateSchema.parse(formData);

      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: validatedData,
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "User created successfully. A secure password has been generated and sent via email.",
      });

      setCreateDialogOpen(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "",
        department_id: "",
        is_active: true,
      });
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
          .upsert({
            user_id: selectedUser.id,
            role: formData.role,
            department_id: formData.role === "admin" ? null : formData.department_id || null,
          });

        if (roleError) throw roleError;
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
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

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "",
      department_id: user.department_id || "",
      is_active: user.is_active,
    });
    setEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: UserRole | null) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "hod":
        return "default";
      case "faculty":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">Manage users, roles, and permissions</p>
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
                  <Label>Role</Label>
                  <UserRoleSelect
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                  />
                </div>
                {formData.role && formData.role !== "admin" && (
                  <div>
                    <Label>Department</Label>
                    <DepartmentSelect
                      value={formData.department_id}
                      onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                    />
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
                  disabled={!formData.full_name || !formData.email || !formData.role}
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
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="hod">HOD</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
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
                        {user.role.toUpperCase()}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-full_name">Full Name</Label>
                <Input
                  id="edit-full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
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
                <Label>Role</Label>
                <UserRoleSelect
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                />
              </div>
              {formData.role && formData.role !== "admin" && (
                <div>
                  <Label>Department</Label>
                  <DepartmentSelect
                    value={formData.department_id}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                  />
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
