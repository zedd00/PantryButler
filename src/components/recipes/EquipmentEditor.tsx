import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronDown, Plus, X, Check } from 'lucide-react';
import { getAllEquipment } from '@/api';
import type { Equipment } from '@/types/types';
import { useTranslation } from 'react-i18next';

interface EquipmentEditorProps {
  equipment: string[];
  onChange: (equipment: string[]) => void;
}

export default function EquipmentEditor({ equipment, onChange }: EquipmentEditorProps) {
  const { t } = useTranslation('recipes');
  const [isOpen, setIsOpen] = useState(false);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const data = await getAllEquipment();
      setAvailableEquipment(data);
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  };

  const addEquipment = (name: string) => {
    if (name.trim() && !equipment.includes(name.trim())) {
      onChange([...equipment, name.trim()]);
      setSearchValue('');
      setSearchOpen(false);
    }
  };

  const removeEquipment = (index: number) => {
    onChange(equipment.filter((_, i) => i !== index));
  };

  const getEquipmentLocation = (equipmentName: string): string | null => {
    const found = availableEquipment.find(e => e.name === equipmentName);
    return found?.location || null;
  };

  // Filter equipment based on search
  const filteredEquipment = availableEquipment.filter(eq =>
    eq.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Check if search value is a new equipment (not in list)
  const isNewEquipment = searchValue.trim() && 
    !availableEquipment.some(eq => eq.name.toLowerCase() === searchValue.toLowerCase());

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          <span>{t('shared.equipmentCount', { count: equipment.length })}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {equipment.map((item, idx) => {
            const location = getEquipmentLocation(item);
            return (
              <Badge key={idx} variant="secondary" className="gap-1">
                {item}
                {location && <span className="text-xs text-muted-foreground ml-1">({location})</span>}
                <button
                  type="button"
                  onClick={() => removeEquipment(idx)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>

        {/* Single searchable dropdown */}
        <div className="space-y-2">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-between"
              >
                <span className="text-muted-foreground">{t('equipmentEditor.addEquipment')}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder={t('equipmentEditor.searchNewEquipment')} 
                  value={searchValue}
                  onValueChange={setSearchValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isNewEquipment && filteredEquipment.length === 0) {
                      e.preventDefault();
                      addEquipment(searchValue);
                    }
                  }}
                />
                <CommandList>
                  <CommandEmpty>
                    {isNewEquipment ? (
                      <div className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => addEquipment(searchValue)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t('equipmentEditor.addQuote', { value: searchValue })}
                        </Button>
                      </div>
                    ) : (
                      t('equipmentEditor.noEquipmentFound')
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredEquipment.map((eq) => (
                      <CommandItem
                        key={eq.id}
                        value={eq.name}
                        onSelect={() => addEquipment(eq.name)}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            equipment.includes(eq.name) ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        {eq.name}
                        {eq.location && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({eq.location})
                          </span>
                        )}
                      </CommandItem>
                    ))}
                    {isNewEquipment && filteredEquipment.length > 0 && (
                      <CommandItem
                        value={searchValue}
                        onSelect={() => addEquipment(searchValue)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('equipmentEditor.addQuote', { value: searchValue })}
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
