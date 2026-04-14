import { ROLE_CONFIG } from "@/lib/constants";
import type { Role } from "@/lib/types";

const ROLES: { key: Role; name: string }[] = [
  { key: "manager", name: "Manager" },
  { key: "cook", name: "Cook" },
  { key: "waiter", name: "Waiter" },
  { key: "dishwasher", name: "Dishwasher" },
];

interface RoleLegendProps {
  activeRulesCount?: number;
}

export function RoleLegend({ activeRulesCount }: RoleLegendProps) {
  return (
    <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0 overflow-x-auto">
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="font-medium shrink-0">Roles</span>
        {ROLES.map(({ key, name }) => (
          <span key={key} className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${ROLE_CONFIG[key].dot}`} aria-hidden="true" />
            {name}
          </span>
        ))}
      </div>
      {activeRulesCount != null && activeRulesCount > 0 && (
        <span className="shrink-0 hidden sm:inline">{activeRulesCount} staffing rules active</span>
      )}
    </div>
  );
}
