import { ReactNode } from "react";
import { ChevronDown, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildTeamHierarchy, HierarchyMember, TeamReportingLink } from "@/lib/teamHierarchy";

interface Props<T extends HierarchyMember> {
  members: T[];
  allMembers: T[];
  links: TeamReportingLink[];
  viewerId: string;
  renderMember: (member: T) => ReactNode;
  searching: boolean;
  organizationView?: boolean;
}

export function TeamHierarchyView<T extends HierarchyMember>({ members, allMembers, links, viewerId, renderMember, searching, organizationView = false }: Props<T>) {
  const hierarchy = buildTeamHierarchy(allMembers, links, viewerId);
  const visible = new Set(members.map(member => member.id));
  const direct = hierarchy.direct.filter(member => visible.has(member.id));
  return <div className="space-y-8">
    {direct.length > 0 && <section className="space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" />Direct reportees <span className="text-sm font-normal text-muted-foreground">{direct.length}</span></h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">{direct.map(renderMember)}</div>
    </section>}
    {[...hierarchy.groups].map(([managerId, group]) => {
      const shown = group.filter(member => visible.has(member.id));
      if (!shown.length) return null;
      const manager = allMembers.find(member => member.id === managerId);
      return <Collapsible key={`${managerId}-${searching}`} defaultOpen className="border-t border-border pt-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="group h-auto w-full justify-between whitespace-normal px-0 py-2 text-left" aria-label={`Toggle ${manager?.fullName || "Other team members"} reportees`}>
            <span className="flex min-w-0 items-start gap-3"><GitBranch className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /><span><span className="block font-semibold break-words">{manager?.fullName || "Other team members"}</span><span className="block text-xs font-normal text-muted-foreground">{manager ? (organizationView ? "Mapped reportees" : "Indirect reportees") : "Other visible members"} · {shown.length}</span></span></span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 border-l-2 border-border pl-3 sm:pl-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">{shown.map(renderMember)}</div>
        </CollapsibleContent>
      </Collapsible>;
    })}
  </div>;
}