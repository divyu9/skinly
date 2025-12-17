import {
  LaptopIcon,
  SmartphoneIcon,
  PlaneIcon,
  CameraIcon,
  CircleDotIcon,
  BatteryChargingIcon,
  TabletSmartphoneIcon,
  GamepadIcon,
  MonitorIcon,
} from "lucide-react";

type DeviceType = "laptop" | "camera" | "lens" | "tablet" | "macmini" | "console" | "drone" | "charger";

interface GadgetSelectorProps {
  onDeviceSelect: (deviceType: DeviceType) => void;
  onPhoneSelect: () => void;
}

export function GadgetSelector({ onDeviceSelect, onPhoneSelect }: GadgetSelectorProps) {
  return (
    <section className="py-16 px-4 bg-muted/20">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black mb-4">What Needs a Makeover?</h2>
          <p className="text-xl text-muted-foreground">We've got skins for all your tech</p>
        </div>

        {/* Gadget Type Cards - 9 total */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          <button
            onClick={() => onDeviceSelect("laptop")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <LaptopIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Laptop</span>
          </button>

          <button
            onClick={onPhoneSelect}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <SmartphoneIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Phones</span>
          </button>

          <button
            onClick={() => onDeviceSelect("macmini")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <MonitorIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Mac Mini</span>
          </button>

          <button
            onClick={() => onDeviceSelect("drone")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <PlaneIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Drones</span>
          </button>

          <button
            onClick={() => onDeviceSelect("camera")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <CameraIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Camera</span>
          </button>

          <button
            onClick={() => onDeviceSelect("lens")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <CircleDotIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Lenses</span>
          </button>

          <button
            onClick={() => onDeviceSelect("charger")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <BatteryChargingIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Chargers</span>
          </button>

          <button
            onClick={() => onDeviceSelect("tablet")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <TabletSmartphoneIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">iPad/Tablet</span>
          </button>

          <button
            onClick={() => onDeviceSelect("console")}
            className="p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-lg transition-all bg-white flex flex-col items-center gap-3"
          >
            <div className="size-16 rounded-full bg-cyan-50 flex items-center justify-center">
              <GamepadIcon className="size-8 text-cyan-500" />
            </div>
            <span className="font-semibold">Gaming Console</span>
          </button>
        </div>
      </div>
    </section>
  );
}
