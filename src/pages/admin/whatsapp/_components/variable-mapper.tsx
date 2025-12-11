import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Settings2, Plus, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface VariableMapperProps {
  usecaseKey: string;
  usecaseName: string;
}

// Common source fields available for mapping
const AVAILABLE_SOURCE_FIELDS: Record<string, string[]> = {
  customer: [
    "customer_name",
    "phone_number",
    "email",
    "customer_id",
  ],
  order: [
    "order_number",
    "order_id",
    "order_date",
    "order_status",
    "number_of_products",
    "order_total",
    "subtotal",
    "tax_amount",
    "shipping_cost",
  ],
  payment: [
    "payment_mode",
    "payment_status",
    "amount",
    "discount",
    "discount_percentage",
    "discount_amount",
    "wallet_amount",
    "cashback_amount",
    "cod_amount",
    "cod_fee",
    "prepaid_amount",
  ],
  shipping: [
    "tracking_url",
    "awb_number",
    "courier_name",
    "estimated_delivery",
    "shipping_address",
  ],
  address: [
    "address_line1",
    "address_line2",
    "city",
    "state",
    "pincode",
  ],
  product: [
    "product_name",
    "product_url",
    "brand_name",
    "model_name",
    "product_price",
    "product_quantity",
    "product_image",
  ],
  coupon: [
    "coupon_code",
  ],
  otp: [
    "otp",
  ],
  urls: [
    "review_url",
    "cart_url",
    "order_url",
    "shop_url",
  ],
  other: [
    "stock_notification",
    "return_policy",
    "support_number",
    "company_name",
  ],
};

export function VariableMapper({ usecaseKey, usecaseName }: VariableMapperProps) {
  const [open, setOpen] = useState(false);
  const [mappings, setMappings] = useState<
    Array<{
      templateVariable: string;
      sourceFields: string[];
      separator: string;
    }>
  >([]);

  const usecaseData = useQuery(
    api.whatsapp.getUsecaseWithTemplate,
    open ? { usecaseKey } : "skip"
  );
  const updateMapping = useMutation(api.whatsapp.updateVariableMapping);

  // Initialize mappings when data loads
  useEffect(() => {
    if (usecaseData?.usecase.variableMapping) {
      // Ensure separator is always defined
      setMappings(
        usecaseData.usecase.variableMapping.map((m) => ({
          ...m,
          separator: m.separator || " ",
        }))
      );
    } else if (usecaseData?.template?.variables) {
      // Auto-initialize with template variables
      setMappings(
        usecaseData.template.variables.map((varName) => ({
          templateVariable: varName,
          sourceFields: [],
          separator: " ",
        }))
      );
    }
  }, [usecaseData]);

  const handleSave = async () => {
    try {
      await updateMapping({
        usecaseKey,
        variableMapping: mappings,
      });
      toast.success("Variable mapping saved successfully");
      setOpen(false);
    } catch (error) {
      toast.error(
        `Failed to save mapping: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const addSourceField = (index: number, field: string) => {
    const newMappings = [...mappings];
    if (!newMappings[index].sourceFields.includes(field)) {
      newMappings[index].sourceFields.push(field);
      setMappings(newMappings);
    }
  };

  const removeSourceField = (mappingIndex: number, fieldIndex: number) => {
    const newMappings = [...mappings];
    newMappings[mappingIndex].sourceFields.splice(fieldIndex, 1);
    setMappings(newMappings);
  };

  const updateSeparator = (index: number, separator: string) => {
    const newMappings = [...mappings];
    newMappings[index].separator = separator;
    setMappings(newMappings);
  };

  // Get all available source fields for this use case type
  const getAvailableFields = (): string[] => {
    const key = usecaseKey.toLowerCase();
    
    // Order-related use cases: show customer, order, payment, shipping, address, product
    if (key.includes("order")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.order,
        ...AVAILABLE_SOURCE_FIELDS.payment,
        ...AVAILABLE_SOURCE_FIELDS.shipping,
        ...AVAILABLE_SOURCE_FIELDS.address,
        ...AVAILABLE_SOURCE_FIELDS.product,
        ...AVAILABLE_SOURCE_FIELDS.urls,
      ];
    }
    
    // OTP use cases
    if (key.includes("otp")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.otp,
      ];
    }
    
    // Product/Stock use cases
    if (key.includes("product") || key.includes("stock")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.product,
        ...AVAILABLE_SOURCE_FIELDS.urls,
      ];
    }
    
    // Review use cases
    if (key.includes("review")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.order,
        ...AVAILABLE_SOURCE_FIELDS.product,
        ...AVAILABLE_SOURCE_FIELDS.urls,
      ];
    }
    
    // Cart use cases
    if (key.includes("cart")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.payment,
        ...AVAILABLE_SOURCE_FIELDS.coupon,
        ...AVAILABLE_SOURCE_FIELDS.urls,
      ];
    }
    
    // Model request use cases
    if (key.includes("model")) {
      return [
        ...AVAILABLE_SOURCE_FIELDS.customer,
        ...AVAILABLE_SOURCE_FIELDS.product,
        ...AVAILABLE_SOURCE_FIELDS.other,
      ];
    }
    
    // Default: all fields
    return Object.values(AVAILABLE_SOURCE_FIELDS).flat();
  };

  const availableFields = getAvailableFields();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Configure Variables
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Variables - {usecaseName}</DialogTitle>
          <DialogDescription>
            Map template variables to source fields. Multiple fields will be combined with the
            separator.
          </DialogDescription>
        </DialogHeader>

        {!usecaseData ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !usecaseData.template ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <div className="flex-1">
                  <p className="font-medium text-orange-900 dark:text-orange-200">
                    No Template Selected
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Please select a template from the dropdown on the main page before configuring variables.
                  </p>
                </div>
              </div>
            </div>
            {usecaseData.usecase.providerTemplateId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-200">
                      Template Link Issue
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This use case has a template ID ({usecaseData.usecase.providerTemplateId}) but the template couldn't be loaded. Try clicking the "Sync Links" button on the main page to fix this.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Template Info */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Template:</p>
                  <Badge variant="outline">{usecaseData.template.templateName}</Badge>
                </div>
                {usecaseData.template.templateBody && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Template Body:</p>
                    <p className="text-sm">{usecaseData.template.templateBody}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Variable Mappings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Variable Mappings</h4>
              {mappings.map((mapping, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {"{{"}{mapping.templateVariable}
                        {"}}"}
                      </p>
                      <p className="text-xs text-muted-foreground">Template Variable</p>
                    </div>
                  </div>

                  {/* Source Fields */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source Fields</label>
                    <div className="flex flex-wrap gap-2">
                      {mapping.sourceFields.map((field, fieldIndex) => (
                        <Badge key={fieldIndex} variant="secondary" className="gap-1">
                          {field}
                          <button
                            onClick={() => removeSourceField(index, fieldIndex)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add Field */}
                    <Select onValueChange={(value) => addSourceField(index, value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Add a source field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields
                          .filter((field) => !mapping.sourceFields.includes(field))
                          .map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Separator */}
                  {mapping.sourceFields.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Separator</label>
                      <Input
                        value={mapping.separator}
                        onChange={(e) => updateSeparator(index, e.target.value)}
                        placeholder="Space"
                        maxLength={10}
                      />
                      <p className="text-xs text-muted-foreground">
                        Character(s) between multiple fields (default: space)
                      </p>
                    </div>
                  )}

                  {/* Preview */}
                  {mapping.sourceFields.length > 0 && (
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                      <p className="mt-1 text-sm">
                        {mapping.sourceFields.join(mapping.separator || " ")}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {mappings.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No variables found in template
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!usecaseData?.template}>
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
