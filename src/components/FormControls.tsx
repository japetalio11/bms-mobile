import type { ComponentProps } from "react";
import { Button as HeroButton, Input as HeroInput, Select, TextField as HeroTextField } from "heroui-native";

type AppInputProps = ComponentProps<typeof HeroInput>;
type AppButtonProps = ComponentProps<typeof HeroButton>;
type AppTextFieldProps = ComponentProps<typeof HeroTextField>;
type AppButtonLabelProps = ComponentProps<typeof HeroButton.Label>;

export function AppInput({ className, style, ...props }: AppInputProps) {
  return (
    <HeroInput
      {...props}
      className={`h-11 rounded-md border border-field-border bg-field-background px-3 text-base text-field-foreground ${className ?? ""}`}
      style={[
        {
          height: 44,
          borderRadius: 6,
          borderWidth: 1,
          fontFamily: "Manrope",
          fontSize: 16,
        },
        style,
      ]}
    />
  );
}

export function AppTextField({ className, ...props }: AppTextFieldProps) {
  return <HeroTextField {...props} className={`gap-1.5 ${className ?? ""}`} />;
}

function StyledAppButton({ variant, className, style, ...props }: AppButtonProps) {
  const primary = variant === "primary";
  return (
    <HeroButton
      {...props}
      variant={variant}
      className={`h-11 min-h-11 rounded-md ${primary ? "bg-[#fffe8c]" : ""} ${className ?? ""}`}
      style={[
        { height: 44, minHeight: 44, borderRadius: 6 },
        primary ? { backgroundColor: "#fffe8c" } : undefined,
        style,
      ]}
    />
  );
}

function StyledAppButtonLabel({ className, style, ...props }: AppButtonLabelProps) {
  return (
    <HeroButton.Label
      {...props}
      className={`text-base font-medium ${className ?? ""}`}
      style={[{ fontFamily: "Manrope-Medium", fontSize: 16 }, style]}
    />
  );
}

export const AppButton = Object.assign(StyledAppButton, { Label: StyledAppButtonLabel });

export function AppSelect({ value, onValueChange, options, placeholder }: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
}) {
  return (
    <Select value={value ? { value, label: value } : undefined} onValueChange={(option) => onValueChange(option?.value ?? "")}>
      <Select.Trigger className="h-12 min-h-12 rounded-md border border-field-border bg-field-background px-3.5 py-0 flex-row items-center justify-between">
        <Select.Value placeholder={placeholder} className="text-sm font-medium text-field-foreground leading-5 pb-0.5" />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger" className="rounded-md border border-field-border bg-background">
          {options.map((option) => (
            <Select.Item key={option} value={option} label={option} className="py-2.5 px-3">
              <Select.ItemLabel className="text-sm text-foreground py-0.5" />
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
