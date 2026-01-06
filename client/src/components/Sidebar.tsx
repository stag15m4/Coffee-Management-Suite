import { Link, useLocation } from "wouter";
import { ChefHat, ShoppingBasket, LayoutDashboard } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/recipes", label: "Recipes", icon: ChefHat },
    { href: "/ingredients", label: "Ingredients", icon: ShoppingBasket },
  ];

  return (
    <div className="w-full md:w-64 md:h-screen bg-card border-b md:border-r border-border flex flex-col sticky top-0 z-10">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <ChefHat className="w-8 h-8 text-accent" />
          <span>Mise</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">Recipe Cost Manager</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
          return (
            <Link key={link.href} href={link.href} className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
              ${isActive 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }
            `}>
              <link.icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-border/50">
        <div className="bg-secondary/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono">v1.0.0-beta</p>
        </div>
      </div>
    </div>
  );
}
