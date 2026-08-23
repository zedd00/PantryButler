import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectGroup {
  label: string;
  options: SearchableSelectOption[];
}

interface SearchableSelectProps {
  options?: SearchableSelectOption[];
  groups?: SearchableSelectGroup[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  groups,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: SearchableSelectProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const resolvedPlaceholder = placeholder ?? t('ui.selectPlaceholder');
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('ui.searchPlaceholder');
  const resolvedEmptyText = emptyText ?? t('ui.noResultsFound');

  // Flatten all options for finding selected
  const allOptions = groups 
    ? groups.flatMap(g => g.options)
    : (options || []);
  
  const selectedOption = allOptions.find((option) => option.value === value);

  // Filter groups based on search term
  const filteredGroups = groups?.map(group => ({
    ...group,
    options: group.options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(group => group.options.length > 0);

  // Filter options based on search term
  const filteredOptions = options?.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
        >
          {selectedOption ? selectedOption.label : resolvedPlaceholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={resolvedSearchPlaceholder} 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
          <div className="max-h-[300px] overflow-auto">
            {groups ? (
              filteredGroups && filteredGroups.length > 0 ? (
                filteredGroups.map((group, idx) => (
                <div key={group.label}>
                  <CommandGroup heading={group.label}>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={`${option.label}__${option.value}`}
                        onSelect={() => {
                          onValueChange(option.value);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === option.value ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {idx < filteredGroups.length - 1 && <CommandSeparator />}
                </div>
              ))
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {resolvedEmptyText}
              </div>
            )
            ) : (
              filteredOptions && filteredOptions.length > 0 ? (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label}__${option.value}`}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center">
                {resolvedEmptyText}
              </div>
            )
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
