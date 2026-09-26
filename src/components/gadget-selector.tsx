import {
  LaptopIcon,
  SmartphoneIcon,
  PlaneIcon,
  CameraIcon,
  CircleDotIcon,
  BatteryChargingIcon,
  TabletSmartphoneIcon,
  GamepadIcon,
  JoystickIcon,
  VideoIcon,
  MonitorIcon,
  ApertureIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The gadget keys the catalogue actually stores on a product and a supported
 * model (`gadgetCategory` / `category`). They are what the picker looks up, so
 * a card that invents its own spelling opens an empty dialog.
 */
export type DeviceType =
  | "laptop" | "phone" | "mac-mini" | "drone" | "camera" | "lens"
  | "charger" | "tablet" | "console" | "controller" | "gimbals" | "action-camera";

const CARDS: Array<{ type: DeviceType; label: string; icon: LucideIcon }> = [
  { type: "laptop", label: "Laptop", icon: LaptopIcon },
  { type: "phone", label: "Phones", icon: SmartphoneIcon },
  { type: "mac-mini", label: "Mac Mini", icon: MonitorIcon },
  { type: "tablet", label: "iPad/Tablet", icon: TabletSmartphoneIcon },
  { type: "camera", label: "Camera", icon: CameraIcon },
  { type: "action-camera", label: "Action Cams", icon: ApertureIcon },
  { type: "lens", label: "Lenses", icon: CircleDotIcon },
  { type: "gimbals", label: "Gimbals", icon: VideoIcon },
  { type: "drone", label: "Drones", icon: PlaneIcon },
  { type: "charger", label: "Chargers", icon: BatteryChargingIcon },
  { type: "console", label: "Gaming Console", icon: GamepadIcon },
  { type: "controller", label: "Controllers", icon: JoystickIcon },
];

interface GadgetSelectorProps {
  onDeviceSelect: (deviceType: DeviceType) => void;
}

export function GadgetSelector({ onDeviceSelect }: GadgetSelectorProps) {
  return (
    <section className="py-16 px-4 bg-muted/20">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black mb-4">What Needs a Makeover?</h2>
          <p className="text-xl text-muted-foreground">We've got skins for all your tech</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {CARDS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onDeviceSelect(type)}
              className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
            >
              <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
                <Icon className="size-8 text-cyan-500" />
              </div>
              <span className="font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
