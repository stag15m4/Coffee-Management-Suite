import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { getShowcaseModules, getModuleShowcaseIcon } from '@/lib/module-registry';

export interface ModuleInfo {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  price: string;
  features: string[];
  example: string;
}

// Derive showcase modules from the registry (only modules with showcase data)
export const DEFAULT_MODULES: ModuleInfo[] = getShowcaseModules().map(def => ({
  id: def.id,
  title: def.showcase!.title,
  description: def.showcase!.description,
  icon: getModuleShowcaseIcon(def.id),
  price: def.showcase!.price,
  features: def.showcase!.features,
  example: def.showcase!.example,
}));

interface ModuleShowcaseProps {
  modules?: ModuleInfo[];
  gradient: string;
}

export function ModuleShowcase({ modules = DEFAULT_MODULES, gradient }: ModuleShowcaseProps) {
  const [, setLocation] = useLocation();
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(null);

  return (
    <>
      <section className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-accent)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: 'var(--color-secondary)' }}
            >
              Powerful Modules, Your Choice
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: 'var(--color-secondary-light)' }}
            >
              Pick the tools you need, or get them all with Professional.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <Card
                key={module.id}
                className="hover-elevate cursor-pointer transition-transform"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
                onClick={() => setSelectedModule(module)}
                data-testid={`card-module-${module.id}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <module.icon className="w-5 h-5 text-white" />
                    </div>
                    <Badge variant="secondary" style={{ color: 'var(--color-secondary-light)' }}>
                      {module.price}
                    </Badge>
                  </div>
                  <CardTitle style={{ color: 'var(--color-secondary)' }}>{module.title}</CardTitle>
                  <CardDescription style={{ color: 'var(--color-secondary-light)' }}>
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                    Click to see examples →
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Module Details Modal */}
      <Dialog open={!!selectedModule} onOpenChange={() => setSelectedModule(null)}>
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
        >
          {selectedModule && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <selectedModule.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle style={{ color: 'var(--color-secondary)' }}>
                      {selectedModule.title}
                    </DialogTitle>
                    <Badge style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                      {selectedModule.price}
                    </Badge>
                  </div>
                </div>
                <DialogDescription style={{ color: 'var(--color-secondary-light)' }}>
                  {selectedModule.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: 'var(--color-secondary)' }}>
                    What You Can Do
                  </h4>
                  <ul className="space-y-2">
                    {selectedModule.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-accent)' }}>
                  <h4 className="font-semibold mb-2" style={{ color: 'var(--color-secondary)' }}>
                    Real Example
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
                    {selectedModule.example}
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setSelectedModule(null);
                    setLocation('/login');
                  }}
                  style={{ background: gradient, color: '#fff', border: 'none' }}
                  data-testid="button-modal-start"
                >
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
