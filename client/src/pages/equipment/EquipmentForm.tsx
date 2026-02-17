import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PhotoCapture } from '@/components/PhotoCapture';
import { colors } from '@/lib/colors';
import { isVehicle } from './equipment-utils';

interface EquipmentFormProps {
  categories: string[];
  newEquipmentName: string;
  setNewEquipmentName: (v: string) => void;
  newEquipmentCategory: string;
  setNewEquipmentCategory: (v: string) => void;
  newEquipmentNotes: string;
  setNewEquipmentNotes: (v: string) => void;
  newEquipmentHasWarranty: boolean;
  setNewEquipmentHasWarranty: (v: boolean) => void;
  newEquipmentPurchaseDate: string;
  setNewEquipmentPurchaseDate: (v: string) => void;
  newEquipmentWarrantyMonths: string;
  setNewEquipmentWarrantyMonths: (v: string) => void;
  newEquipmentWarrantyNotes: string;
  setNewEquipmentWarrantyNotes: (v: string) => void;
  newEquipmentInServiceDate: string;
  setNewEquipmentInServiceDate: (v: string) => void;
  newEquipmentPhotoUrl: string;
  setNewEquipmentPhotoUrl: (v: string) => void;
  newEquipmentLicenseState: string;
  setNewEquipmentLicenseState: (v: string) => void;
  newEquipmentLicensePlate: string;
  setNewEquipmentLicensePlate: (v: string) => void;
  newEquipmentVin: string;
  setNewEquipmentVin: (v: string) => void;
  newEquipmentModel: string;
  setNewEquipmentModel: (v: string) => void;
  newEquipmentSerialNumber: string;
  setNewEquipmentSerialNumber: (v: string) => void;
  isUploadingNewPhoto: boolean;
  handleEquipmentPhotoUpload: (file: File, mode: 'new' | 'edit') => Promise<void>;
  handleAddEquipment: () => Promise<void>;
  addEquipmentMutationIsPending: boolean;
  setShowAddEquipment: (show: boolean) => void;
}

export function EquipmentForm({
  categories,
  newEquipmentName,
  setNewEquipmentName,
  newEquipmentCategory,
  setNewEquipmentCategory,
  newEquipmentNotes,
  setNewEquipmentNotes,
  newEquipmentHasWarranty,
  setNewEquipmentHasWarranty,
  newEquipmentPurchaseDate,
  setNewEquipmentPurchaseDate,
  newEquipmentWarrantyMonths,
  setNewEquipmentWarrantyMonths,
  newEquipmentWarrantyNotes,
  setNewEquipmentWarrantyNotes,
  newEquipmentInServiceDate,
  setNewEquipmentInServiceDate,
  newEquipmentPhotoUrl,
  setNewEquipmentPhotoUrl,
  newEquipmentLicenseState,
  setNewEquipmentLicenseState,
  newEquipmentLicensePlate,
  setNewEquipmentLicensePlate,
  newEquipmentVin,
  setNewEquipmentVin,
  newEquipmentModel,
  setNewEquipmentModel,
  newEquipmentSerialNumber,
  setNewEquipmentSerialNumber,
  isUploadingNewPhoto,
  handleEquipmentPhotoUpload,
  handleAddEquipment,
  addEquipmentMutationIsPending,
  setShowAddEquipment,
}: EquipmentFormProps) {
  return (
    <Card style={{ backgroundColor: colors.white, borderColor: colors.gold, borderWidth: 2 }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg" style={{ color: colors.brown }}>Add Equipment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label style={{ color: colors.brown }}>Name *</Label>
          <Input
            value={newEquipmentName}
            onChange={e => setNewEquipmentName(e.target.value)}
            placeholder="e.g., Grinder 1, La Marzocca"
            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
            data-testid="input-equipment-name"
          />
        </div>
        {!isVehicle(newEquipmentCategory) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label style={{ color: colors.brown }}>Model</Label>
              <Input
                value={newEquipmentModel}
                onChange={e => setNewEquipmentModel(e.target.value)}
                placeholder="e.g., Mazzer Mini"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-equipment-model"
              />
            </div>
            <div>
              <Label style={{ color: colors.brown }}>Serial Number</Label>
              <Input
                value={newEquipmentSerialNumber}
                onChange={e => setNewEquipmentSerialNumber(e.target.value)}
                placeholder="e.g., SN-12345678"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-equipment-serial-number"
              />
            </div>
          </div>
        )}
        <PhotoCapture
          currentPhotoUrl={newEquipmentPhotoUrl || null}
          onPhotoSelected={async (file) => handleEquipmentPhotoUpload(file, 'new')}
          onPhotoRemoved={() => setNewEquipmentPhotoUrl('')}
          isUploading={isUploadingNewPhoto}
          shape="square"
          size={96}
          label="Equipment Photo"
        />
        <div>
          <Label style={{ color: colors.brown }}>Category</Label>
          {categories.length > 0 && (
            <Select
              value={categories.includes(newEquipmentCategory) ? newEquipmentCategory : ''}
              onValueChange={(value) => {
                if (value === '__new__') {
                  setNewEquipmentCategory('');
                } else {
                  setNewEquipmentCategory(value);
                }
              }}
            >
              <SelectTrigger
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="select-equipment-category"
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
          {(categories.length === 0 || !categories.includes(newEquipmentCategory)) && (
            <Input
              value={newEquipmentCategory}
              onChange={e => setNewEquipmentCategory(e.target.value)}
              placeholder="e.g., Grinders, Espresso Machines"
              className={categories.length > 0 ? 'mt-2' : ''}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
              data-testid="input-equipment-category"
            />
          )}
        </div>
        <div>
          <Label style={{ color: colors.brown }}>Notes</Label>
          <Textarea
            value={newEquipmentNotes}
            onChange={e => setNewEquipmentNotes(e.target.value)}
            placeholder="Serial number, location, etc."
            style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
            data-testid="input-equipment-notes"
          />
        </div>

        <div>
          <Label style={{ color: colors.brown }}>In Service Date</Label>
          <Input
            type="date"
            value={newEquipmentInServiceDate}
            onChange={e => setNewEquipmentInServiceDate(e.target.value)}
            style={{ backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.brown }}
            data-testid="input-equipment-in-service-date"
          />
        </div>

        {isVehicle(newEquipmentCategory) && (
          <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
            <p className="text-xs font-medium" style={{ color: colors.brown }}>Vehicle Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label style={{ color: colors.brown }}>License State</Label>
                <Input
                  value={newEquipmentLicenseState}
                  onChange={e => setNewEquipmentLicenseState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="e.g., NC"
                  maxLength={2}
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-equipment-license-state"
                />
              </div>
              <div>
                <Label style={{ color: colors.brown }}>License Plate</Label>
                <Input
                  value={newEquipmentLicensePlate}
                  onChange={e => setNewEquipmentLicensePlate(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC-1234"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                  data-testid="input-equipment-license-plate"
                />
              </div>
            </div>
            <div>
              <Label style={{ color: colors.brown }}>VIN</Label>
              <Input
                value={newEquipmentVin}
                onChange={e => setNewEquipmentVin(e.target.value.toUpperCase())}
                placeholder="17-character VIN"
                maxLength={17}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-equipment-vin"
              />
            </div>
          </div>
        )}

        <div className="pt-2 border-t" style={{ borderColor: colors.creamDark }}>
          <div className="flex items-center justify-between">
            <Label style={{ color: colors.brown }}>Has Warranty?</Label>
            <Switch
              checked={newEquipmentHasWarranty}
              onCheckedChange={setNewEquipmentHasWarranty}
              data-testid="switch-equipment-warranty"
            />
          </div>
        </div>

        {newEquipmentHasWarranty && (
          <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: colors.gold }}>
            <div>
              <Label style={{ color: colors.brown }}>Purchase Date *</Label>
              <Input
                type="date"
                value={newEquipmentPurchaseDate}
                onChange={e => setNewEquipmentPurchaseDate(e.target.value)}
                style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                data-testid="input-equipment-purchase-date"
              />
            </div>
            <div>
              <Label style={{ color: colors.brown }}>Warranty Duration (months) *</Label>
              <Input
                type="number"
                min="1"
                value={newEquipmentWarrantyMonths}
                onChange={e => setNewEquipmentWarrantyMonths(e.target.value)}
                placeholder="e.g., 12, 24, 36"
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-equipment-warranty-months"
                inputMode="numeric"
              />
            </div>
            <div>
              <Label style={{ color: colors.brown }}>Warranty Notes</Label>
              <Textarea
                value={newEquipmentWarrantyNotes}
                onChange={e => setNewEquipmentWarrantyNotes(e.target.value)}
                placeholder="Coverage details, exclusions, claim info..."
                style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                data-testid="input-equipment-warranty-notes"
              />
            </div>
          </div>
        )}

        <p className="text-xs" style={{ color: colors.brownLight }}>
          Save first, then edit to add attachments (manuals, warranty docs, links).
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleAddEquipment}
            disabled={addEquipmentMutationIsPending}
            style={{ backgroundColor: colors.gold, color: colors.white }}
            data-testid="button-save-equipment"
          >
            {addEquipmentMutationIsPending ? 'Saving...' : 'Save Equipment'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowAddEquipment(false);
              setNewEquipmentName('');
              setNewEquipmentCategory('');
              setNewEquipmentNotes('');
              setNewEquipmentHasWarranty(false);
              setNewEquipmentPurchaseDate('');
              setNewEquipmentWarrantyMonths('');
              setNewEquipmentWarrantyNotes('');
              setNewEquipmentInServiceDate('');
              setNewEquipmentPhotoUrl('');
              setNewEquipmentLicenseState('');
              setNewEquipmentLicensePlate('');
              setNewEquipmentVin('');
              setNewEquipmentModel('');
              setNewEquipmentSerialNumber('');
            }}
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="button-cancel-equipment"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
