import { useState } from "react";
import { useLocation } from "wouter";
import { MoreHorizontal } from "lucide-react";
import { useNavigation } from "./NavigationProvider";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

const MAX_VISIBLE_TABS = 5;

export function BottomTabBar() {
  const { mobileTabItems, primaryItems, settingsItems, utilityItems } =
    useNavigation();
  const [location, setLocation] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const needsMoreTab = mobileTabItems.length > MAX_VISIBLE_TABS;
  const visibleTabs = needsMoreTab
    ? mobileTabItems.slice(0, MAX_VISIBLE_TABS - 1)
    : mobileTabItems.slice(0, MAX_VISIBLE_TABS);

  // Items shown in the "More" sheet: remaining tab items + settings + utility
  const overflowTabItems = needsMoreTab
    ? mobileTabItems.slice(MAX_VISIBLE_TABS - 1)
    : [];

  const moreSheetItems = primaryItems.filter(
    (item) => !visibleTabs.some((tab) => tab.id === item.id)
  );

  const isTabActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(href + "/");
  };

  const isMoreActive =
    needsMoreTab && overflowTabItems.some((item) => isTabActive(item.href));

  const handleNavigate = (href: string) => {
    setLocation(href);
    setMoreOpen(false);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-around items-center">
          {visibleTabs.map((item) => {
            const active = isTabActive(item.href);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.href)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] relative"
                style={{
                  color: active
                    ? "var(--color-primary)"
                    : "var(--color-secondary)",
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {needsMoreTab && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px]"
              style={{
                color: isMoreActive
                  ? "var(--color-primary)"
                  : "var(--color-secondary)",
              }}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium truncate">More</span>
            </button>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetTitle className="sr-only">More Navigation</SheetTitle>

          {moreSheetItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Pages
              </p>
              <div className="space-y-1">
                {moreSheetItems.map((item) => {
                  const Icon = item.icon;
                  const active = isTabActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.href)}
                      className="flex items-center gap-3 w-full rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-100"
                      style={{
                        color: active
                          ? "var(--color-primary)"
                          : undefined,
                      }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {settingsItems && settingsItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Settings
              </p>
              <div className="space-y-1">
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  const active = isTabActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.href)}
                      className="flex items-center gap-3 w-full rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-100"
                      style={{
                        color: active
                          ? "var(--color-primary)"
                          : undefined,
                      }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {utilityItems && utilityItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                More
              </p>
              <div className="space-y-1">
                {utilityItems.map((item) => {
                  const Icon = item.icon;
                  const active = isTabActive(item.href);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.href)}
                      className="flex items-center gap-3 w-full rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-100"
                      style={{
                        color: active
                          ? "var(--color-primary)"
                          : undefined,
                      }}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
