import { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const PREDEFINED_VARIABLES = [
  { value: "customer_name", label: "Customer Name" },
  { value: "order_number", label: "Order Number" },
  { value: "order_id", label: "Order ID" },
  { value: "phone_number", label: "Phone Number" },
  { value: "email", label: "Email" },
  { value: "tracking_url", label: "Tracking URL" },
  { value: "awb_number", label: "AWB Number" },
  { value: "courier_name", label: "Courier Name" },
  { value: "product_name", label: "Product Name" },
  { value: "product_url", label: "Product URL" },
  { value: "coupon_code", label: "Coupon Code" },
  { value: "discount", label: "Discount" },
  { value: "otp", label: "OTP" },
  { value: "brand_name", label: "Brand Name" },
  { value: "model_name", label: "Model Name" },
  { value: "review_url", label: "Review URL" },
  { value: "cart_url", label: "Cart URL" },
];

interface VariablesMultiSelectProps {
  value: string[]; // Array of selected variable values
  onChange: (values: string[]) => void;
}

export function VariablesMultiSelect({ value, onChange }: VariablesMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (variableValue: string) => {
    const newValues = value.includes(variableValue)
      ? value.filter((v) => v !== variableValue)
      : [...value, variableValue];
    onChange(newValues);
  };

  const handleRemove = (variableValue: string) => {
    onChange(value.filter((v) => v !== variableValue));
  };

  const getLabel = (val: string) => {
    const variable = PREDEFINED_VARIABLES.find((v) => v.value === val);
    return variable?.label ?? val;
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length === 0
              ? "Select variables..."
              : `${value.length} variable${value.length !== 1 ? "s" : ""} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search variables..." />
            <CommandList>
              <CommandEmpty>No variables found.</CommandEmpty>
              <CommandGroup>
                {PREDEFINED_VARIABLES.map((variable) => (
                  <CommandItem
                    key={variable.value}
                    value={variable.value}
                    onSelect={() => handleSelect(variable.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(variable.value) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {variable.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {`{${variable.value}}`}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Variables as Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((val) => (
            <Badge key={val} variant="secondary" className="gap-1">
              {`{${val}}`}
              <button
                type="button"
                onClick={() => handleRemove(val)}
                className="ml-1 rounded-full hover:bg-secondary-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
