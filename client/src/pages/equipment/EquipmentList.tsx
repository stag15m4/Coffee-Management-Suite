import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PhotoCapture } from '@/components/PhotoCapture';
import { EquipmentAttachments } from '@/components/EquipmentAttachments';
import { colors } from '@/lib/colors';
import {
  Plus,
  Settings,
  Download,
  Printer,
  Trash2,
  Edit2,
  Check,
  X,
  Shield,
  ShieldOff,
} from 'lucide-react';
import type { Equipment, MaintenanceTask } from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase-queries';
import { useToast } from '@/hooks/use-toast';
import {
  isVehicle,
  getWarrantyStatus,
  formatWarrantyInfo,
  parseLocalDate,
  exportEquipmentRecords,
  exportEquipmentListCSV,
  exportEquipmentListPDF,
} from './equipment-utils';

interface EquipmentListProps {
  equipment: Equipment[];
  tasks: MaintenanceTask[];
  categories: string[];
  displayName?: string;
  editingEquipment: Equipment | null;
  setEditingEquipment: (eq: Equipment | null | ((prev: Equipment | null) => Equipment | null)) => void;
  isUploadingEditPhoto: boolean;
  handleEquipmentPhotoUpload: (file: File, mode: 'new' | 'edit') => Promise<void>;
  handleEditEquipment: (item: Equipment) => Promise<void>;
  handleUpdateEquipment: () => void;
  handleAutoSaveEquipment: () => void;
  handleCancelEditEquipment: () => Promise<void>;
  handleDeleteEquipment: (id: string) => Promise<void>;
  updateEquipmentMutation: { isPending: boolean };
  setShowAddEquipment: (show: boolean) => void;
}

export function EquipmentList({
  equipment,
  tasks,
  categories,
  displayName,
  editingEquipment,
  setEditingEquipment,
  isUploadingEditPhoto,
  handleEquipmentPhotoUpload,
  handleEditEquipment,
  handleUpdateEquipment,
  handleAutoSaveEquipment,
  handleCancelEditEquipment,
  handleDeleteEquipment,
  updateEquipmentMutation,
  setShowAddEquipment,
}: EquipmentListProps) {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold" style={{ color: colors.brown }}>Equipment List</h2>
        <div className="flex gap-2">
          {equipment.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => exportEquipmentListPDF(equipment, displayName)}
                style={{ borderColor: colors.gold, color: colors.brown }}
                data-testid="button-print-equipment-list"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  exportEquipmentListCSV(equipment);
                  toast({ title: 'Equipment list exported' });
                }}
                style={{ borderColor: colors.gold, color: colors.brown }}
                data-testid="button-export-equipment-list"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </>
          )}
          <Button
            onClick={() => setShowAddEquipment(true)}
            style={{ backgroundColor: colors.gold, color: colors.white }}
            data-testid="button-add-equipment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Equipment
          </Button>
        </div>
      </div>

      {equipment.length === 0 ? (
        <Card style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
          <CardContent className="p-8 text-center">
            <Settings className="w-12 h-12 mx-auto mb-4" style={{ color: colors.brownLight }} />
            <h3 className="font-semibold mb-2" style={{ color: colors.brown }}>No Equipment Yet</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Add your equipment to start tracking maintenance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {equipment.map(item => (
            <Card
              key={item.id}
              style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
              data-testid={`equipment-card-${item.id}`}
            >
              <CardContent className="p-4">
                {editingEquipment?.id === item.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editingEquipment.name}
                      onChange={e => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-edit-equipment-name"
                    />
                    {!isVehicle(editingEquipment.category) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label style={{ color: colors.brown }}>Model</Label>
                          <Input
                            value={editingEquipment.model || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, model: e.target.value || null })}
                            placeholder="e.g., Mazzer Mini"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-model"
                          />
                        </div>
                        <div>
                          <Label style={{ color: colors.brown }}>Serial Number</Label>
                          <Input
                            value={editingEquipment.serial_number || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, serial_number: e.target.value || null })}
                            placeholder="e.g., SN-12345678"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-serial-number"
                          />
                        </div>
                      </div>
                    )}
                    <PhotoCapture
                      currentPhotoUrl={editingEquipment.photo_url}
                      onPhotoSelected={async (file) => handleEquipmentPhotoUpload(file, 'edit')}
                      onPhotoRemoved={() => setEditingEquipment({ ...editingEquipment, photo_url: null })}
                      isUploading={isUploadingEditPhoto}
                      shape="square"
                      size={96}
                      label="Equipment Photo"
                    />
                    <div>
                      {categories.length > 0 && (
                        <Select
                          value={categories.includes(editingEquipment.category || '') ? editingEquipment.category || '' : ''}
                          onValueChange={(value) => {
                            if (value === '__new__') {
                              setEditingEquipment({ ...editingEquipment, category: '' });
                            } else {
                              setEditingEquipment({ ...editingEquipment, category: value });
                            }
                          }}
                        >
                          <SelectTrigger
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="select-edit-equipment-category"
                          >
                            <SelectValue placeholder="Select or add new" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Add new category...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {(categories.length === 0 || !categories.includes(editingEquipment.category || '')) && (
                        <Input
                          value={editingEquipment.category || ''}
                          onChange={e => setEditingEquipment({ ...editingEquipment, category: e.target.value })}
                          placeholder="Category (e.g., Grinders)"
                          className={categories.length > 0 ? 'mt-2' : ''}
                          style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                          data-testid="input-edit-equipment-category"
                        />
                      )}
                    </div>
                    <Textarea
                      value={editingEquipment.notes || ''}
                      onChange={e => setEditingEquipment({ ...editingEquipment, notes: e.target.value })}
                      placeholder="Notes"
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                      data-testid="input-edit-equipment-notes"
                    />

                    <div>
                      <Label style={{ color: colors.brown }}>In Service Date</Label>
                      <Input
                        type="date"
                        value={editingEquipment.in_service_date || ''}
                        onChange={e => setEditingEquipment({ ...editingEquipment, in_service_date: e.target.value || null })}
                        style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }}
                        data-testid="input-edit-equipment-in-service-date"
                      />
                    </div>

                    {isVehicle(editingEquipment.category) && (
                      <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
                        <p className="text-xs font-medium" style={{ color: colors.brown }}>Vehicle Info</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label style={{ color: colors.brown }}>License State</Label>
                            <Input
                              value={editingEquipment.license_state || ''}
                              onChange={e => setEditingEquipment({ ...editingEquipment, license_state: e.target.value.toUpperCase().slice(0, 2) || null })}
                              placeholder="e.g., NC"
                              maxLength={2}
                              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                              data-testid="input-edit-equipment-license-state"
                            />
                          </div>
                          <div>
                            <Label style={{ color: colors.brown }}>License Plate</Label>
                            <Input
                              value={editingEquipment.license_plate || ''}
                              onChange={e => setEditingEquipment({ ...editingEquipment, license_plate: e.target.value.toUpperCase() || null })}
                              placeholder="e.g., ABC-1234"
                              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                              data-testid="input-edit-equipment-license-plate"
                            />
                          </div>
                        </div>
                        <div>
                          <Label style={{ color: colors.brown }}>VIN</Label>
                          <Input
                            value={editingEquipment.vin || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, vin: e.target.value.toUpperCase() || null })}
                            placeholder="17-character VIN"
                            maxLength={17}
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-vin"
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t" style={{ borderColor: colors.creamDark }}>
                      <div className="flex items-center justify-between">
                        <Label style={{ color: colors.brown }}>Has Warranty?</Label>
                        <Switch
                          checked={editingEquipment.has_warranty || false}
                          onCheckedChange={(checked) => setEditingEquipment({ ...editingEquipment, has_warranty: checked })}
                          data-testid="switch-edit-equipment-warranty"
                        />
                      </div>
                    </div>

                    {editingEquipment.has_warranty && (
                      <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
                        <div>
                          <Label style={{ color: colors.brown }}>Purchase Date *</Label>
                          <Input
                            type="date"
                            value={editingEquipment.purchase_date || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, purchase_date: e.target.value || null })}
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                            data-testid="input-edit-equipment-purchase-date"
                          />
                        </div>
                        <div>
                          <Label style={{ color: colors.brown }}>Warranty Duration (months) *</Label>
                          <Input
                            type="number"
                            min="1"
                            value={editingEquipment.warranty_duration_months || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, warranty_duration_months: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="e.g., 12, 24, 36"
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-warranty-months"
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <Label style={{ color: colors.brown }}>Warranty Notes</Label>
                          <Textarea
                            value={editingEquipment.warranty_notes || ''}
                            onChange={e => setEditingEquipment({ ...editingEquipment, warranty_notes: e.target.value || null })}
                            placeholder="Coverage details, exclusions, claim info..."
                            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                            data-testid="input-edit-equipment-warranty-notes"
                          />
                        </div>
                      </div>
                    )}

                    <EquipmentAttachments
                      equipmentId={editingEquipment.id}
                      tenantId={editingEquipment.tenant_id}
                      onAttachmentAdded={handleAutoSaveEquipment}
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleUpdateEquipment}
                        disabled={updateEquipmentMutation.isPending}
                        style={{ backgroundColor: colors.gold, color: colors.white }}
                        data-testid="button-save-edit-equipment"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditEquipment}
                        style={{ borderColor: colors.creamDark, color: colors.brown }}
                        data-testid="button-cancel-edit-equipment"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    {item.photo_url && (
                      <div
                        className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ border: `2px solid ${colors.creamDark}` }}
                      >
                        <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" style={{ color: colors.brown }}>{item.name}</span>
                        {item.category && (
                          <Badge variant="outline" style={{ borderColor: colors.gold, color: colors.brownLight }}>
                            {item.category}
                          </Badge>
                        )}
                        {getWarrantyStatus(item) === 'covered' && (
                          <Badge
                            className="gap-1"
                            style={{ backgroundColor: colors.green, color: 'white' }}
                            data-testid={`badge-warranty-covered-${item.id}`}
                          >
                            <Shield className="w-3 h-3" />
                            Under Warranty
                          </Badge>
                        )}
                        {getWarrantyStatus(item) === 'expired' && (
                          <Badge
                            className="gap-1"
                            style={{ backgroundColor: colors.red, color: 'white' }}
                            data-testid={`badge-warranty-expired-${item.id}`}
                          >
                            <ShieldOff className="w-3 h-3" />
                            Warranty Expired
                          </Badge>
                        )}
                      </div>
                      {!isVehicle(item.category) && (item.model || item.serial_number) && (
                        <div className="mt-1 text-xs space-x-3" style={{ color: colors.brownLight }}>
                          {item.model && <span>Model: {item.model}</span>}
                          {item.serial_number && <span>S/N: {item.serial_number}</span>}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-sm mt-2" style={{ color: colors.brownLight }}>{item.notes}</p>
                      )}
                      {isVehicle(item.category) && (item.license_plate || item.vin) && (
                        <div className="mt-2 text-xs space-y-1" style={{ color: colors.brownLight }}>
                          {item.license_plate && (
                            <p>Plate: {item.license_state ? `${item.license_state} ` : ''}{item.license_plate}</p>
                          )}
                          {item.vin && <p>VIN: {item.vin}</p>}
                        </div>
                      )}
                      {item.has_warranty && item.purchase_date && (
                        <div className="mt-2 text-xs space-y-1" style={{ color: colors.brownLight }}>
                          <p>Purchased: {parseLocalDate(item.purchase_date).toLocaleDateString()}</p>
                          <p>In Service: {parseLocalDate(item.in_service_date || item.purchase_date).toLocaleDateString()}</p>
                          {item.warranty_duration_months && (
                            <p>{formatWarrantyInfo(item)}</p>
                          )}
                          {item.warranty_notes && (
                            <p className="italic">{item.warranty_notes}</p>
                          )}
                        </div>
                      )}
                      {!(item.has_warranty && item.purchase_date) && (
                        <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
                          In Service: {item.in_service_date ? parseLocalDate(item.in_service_date).toLocaleDateString() : 'Not set'}
                        </p>
                      )}
                      <EquipmentAttachments
                        equipmentId={item.id}
                        tenantId={item.tenant_id}
                        readOnly
                      />
                      <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
                        {tasks.filter(t => t.equipment_id === item.id).length} maintenance tasks
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          toast({ title: 'Generating record...' });
                          exportEquipmentRecords(item, supabase)
                            .then(() => toast({ title: 'Equipment record ready for download' }))
                            .catch((err) => toast({ title: 'Export failed', description: err.message, variant: 'destructive' }));
                        }}
                        title="Export maintenance records"
                        style={{ color: colors.gold }}
                        data-testid={`button-export-equipment-${item.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditEquipment(item)}
                        style={{ color: colors.brown }}
                        data-testid={`button-edit-equipment-${item.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteEquipment(item.id)}
                        style={{ color: colors.red }}
                        data-testid={`button-delete-equipment-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
