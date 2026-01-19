import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLabels } from "@/contexts/LabelContext";
import { Loader2, Plus, Trash2, Calendar, CalendarDays } from "lucide-react";
import { isRole } from "@/lib/roleMapping";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
}

interface WorkingDays {
  id?: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

interface HolidaysSettingsProps {
  selectedScope: "organization" | string;
  verticalId: string | null;
}

const defaultWorkingDays: WorkingDays = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function HolidaysSettings({ selectedScope, verticalId }: HolidaysSettingsProps) {
  const { userWithRole } = useAuth();
  const { entityLabel } = useLabels();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [workingDays, setWorkingDays] = useState<WorkingDays>(defaultWorkingDays);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>();
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const isOrgAdmin = isRole(userWithRole?.role, "admin", "org_admin", "super_admin");
  const canEdit = isOrgAdmin;

  useEffect(() => {
    fetchOrganizationId();
  }, [userWithRole]);

  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId, verticalId]);

  const fetchOrganizationId = async () => {
    if (!userWithRole?.user?.id) return;
    
    const { data } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", userWithRole.user.id)
      .single();
    
    if (data?.organization_id) {
      setOrganizationId(data.organization_id);
    }
  };

  const fetchData = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      // Fetch working days - handle null vs non-null vertical_id
      let workingDaysQuery = supabase
        .from("working_days")
        .select("*")
        .eq("organization_id", organizationId);
      
      if (verticalId) {
        workingDaysQuery = workingDaysQuery.eq("vertical_id", verticalId);
      } else {
        workingDaysQuery = workingDaysQuery.is("vertical_id", null);
      }
      
      const { data: workingDaysData } = await workingDaysQuery;

      if (workingDaysData && workingDaysData.length > 0) {
        setWorkingDays(workingDaysData[0]);
      } else {
        setWorkingDays(defaultWorkingDays);
      }

      // Fetch holidays - handle null vs non-null vertical_id
      let holidaysQuery = supabase
        .from("holidays")
        .select("*")
        .eq("organization_id", organizationId)
        .order("holiday_date", { ascending: true });
      
      if (verticalId) {
        holidaysQuery = holidaysQuery.eq("vertical_id", verticalId);
      } else {
        holidaysQuery = holidaysQuery.is("vertical_id", null);
      }
      
      const { data: holidaysData } = await holidaysQuery;

      setHolidays(holidaysData || []);
    } catch (error) {
      console.error("Error fetching holidays settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkingDayChange = (day: keyof WorkingDays, checked: boolean) => {
    setWorkingDays(prev => ({ ...prev, [day]: checked }));
  };

  const handleSaveWorkingDays = async () => {
    if (!organizationId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("working_days")
        .upsert({
          organization_id: organizationId,
          vertical_id: verticalId,
          ...workingDays,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "organization_id,vertical_id",
        });

      if (error) throw error;

      toast({
        title: "Working days saved",
        description: "Your working days configuration has been updated.",
      });
      fetchData();
    } catch (error) {
      console.error("Error saving working days:", error);
      toast({
        title: "Error",
        description: "Failed to save working days. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!organizationId || !newHolidayName.trim() || !newHolidayDate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("holidays")
        .insert({
          organization_id: organizationId,
          vertical_id: verticalId,
          name: newHolidayName.trim(),
          holiday_date: format(newHolidayDate, "yyyy-MM-dd"),
        });

      if (error) throw error;

      toast({
        title: "Holiday added",
        description: `${newHolidayName} has been added.`,
      });
      setNewHolidayName("");
      setNewHolidayDate(undefined);
      fetchData();
    } catch (error: any) {
      console.error("Error adding holiday:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") 
          ? "A holiday already exists on this date." 
          : "Failed to add holiday. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("holidays")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Holiday removed",
        description: "The holiday has been removed.",
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast({
        title: "Error",
        description: "Failed to remove holiday. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Holidays & Working Days
        </CardTitle>
        <CardDescription>
          Configure working days and holidays for {verticalId ? `this ${entityLabel("vertical").toLowerCase()}` : "the organization"}.
          These settings affect calendar calculations and timesheet validations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working Days Section */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Working Days</Label>
          <p className="text-sm text-muted-foreground">
            Select which days are working days. Non-working days will be excluded from daily target calculations.
          </p>
          <div className="flex flex-wrap gap-3">
            {dayNames.map((day, index) => (
              <div
                key={day}
                className="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2"
              >
                <Checkbox
                  id={`day-${day}`}
                  checked={workingDays[day]}
                  onCheckedChange={(checked) => handleWorkingDayChange(day, checked as boolean)}
                  disabled={!canEdit}
                />
                <Label htmlFor={`day-${day}`} className="text-sm font-medium cursor-pointer">
                  {dayLabels[index]}
                </Label>
              </div>
            ))}
          </div>
          {canEdit && (
            <Button onClick={handleSaveWorkingDays} disabled={saving} size="sm">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Working Days
            </Button>
          )}
        </div>

        {/* Holidays Section */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-base font-medium">Holidays</Label>
          <p className="text-sm text-muted-foreground">
            Add holidays that will be excluded from working day calculations.
          </p>
          
          {/* Holidays List */}
          {holidays.length > 0 ? (
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{holiday.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(holiday.holiday_date), "MMMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">
              No holidays configured yet.
            </p>
          )}

          {/* Add Holiday Form */}
          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Input
                placeholder="Holiday name"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="w-48"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {newHolidayDate ? format(newHolidayDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={newHolidayDate}
                    onSelect={setNewHolidayDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleAddHoliday}
                disabled={saving || !newHolidayName.trim() || !newHolidayDate}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Holiday
              </Button>
            </div>
          )}
        </div>

        {!canEdit && (
          <p className="text-sm text-muted-foreground pt-4 border-t">
            Only organization administrators can modify these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}