import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface SearchableMapperProps {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ id: string; name: string }>;
  originalName: string;
  placeholder?: string;
  emptyText?: string;
}

export function SearchableMapper({
  value,
  onValueChange,
  items,
  originalName,
  placeholder,
  emptyText,
}: SearchableMapperProps) {
  const { t } = useTranslation('recipes');
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const selectedItem = items.find(item => item.id === value);
  const displayValue = value === 'new' ? t('searchableMapper.createNew', { name: originalName }) : selectedItem?.name || originalName;

  // Filter items based on search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder || t('searchableMapper.searchPlaceholder')}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText || t('searchableMapper.noItemsFound')}</CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onValueChange(item.id);
                    setOpen(false);
                    setSearchValue('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.name}
                </CommandItem>
              ))}
              <CommandItem
                value="new"
                onSelect={() => {
                  onValueChange('new');
                  setOpen(false);
                  setSearchValue('');
                }}
                className="border-t"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === 'new' ? "opacity-100" : "opacity-0"
                  )}
                />
                {t('searchableMapper.createNew', { name: originalName })}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
