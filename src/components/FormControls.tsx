import type { ComponentProps } from "react";
import { Button as HeroButton, Input as HeroInput, Select, TextField as HeroTextField } from "heroui-native";

type AppInputProps = ComponentProps<typeof HeroInput>;
type AppButtonProps = ComponentProps<typeof HeroButton>;
type AppTextFieldProps = ComponentProps<typeof HeroTextField>;
type AppButtonLabelProps = ComponentProps<typeof HeroButton.Label>;

/** Shared text field used across forms, sheets, and account screens. */
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

/** Shared label/input group spacing for predictable form rhythm. */
export function AppTextField({ className, ...props }: AppTextFieldProps) {
  return <HeroTextField {...props} className={`gap-1.5 ${className ?? ""}`} />;
}

/** Keeps action buttons on the same compact radius and primary accent. */
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
      <Select.Trigger className="h-11 rounded-md border border-field-border bg-field-background px-3">
        <Select.Value placeholder={placeholder} className="text-base text-field-foreground" />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger" className="rounded-md border border-field-border bg-background">
          {options.map((option) => (
            <Select.Item key={option} value={option} label={option}>
              <Select.ItemLabel />
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
