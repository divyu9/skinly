import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { ShieldCheckIcon } from "lucide-react";

interface CodOtpSectionProps {
  fullPhoneNumber: string;
  isPhoneValid: boolean;
  otpSent: boolean;
  otpVerified: boolean;
  otpInput: string;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  onOtpInputChange: (value: string) => void;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
}

export function CodOtpSection({
  fullPhoneNumber,
  isPhoneValid,
  otpSent,
  otpVerified,
  otpInput,
  isSendingOtp,
  isVerifyingOtp,
  onOtpInputChange,
  onSendOtp,
  onVerifyOtp,
}: CodOtpSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" />
          Verify Your Phone Number
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!otpVerified ? (
          <>
            <p className="text-sm text-muted-foreground">
              For COD orders, we need to verify your phone number. An OTP will be sent to your WhatsApp.
            </p>

            {!otpSent ? (
              <Button
                type="button"
                onClick={onSendOtp}
                disabled={!fullPhoneNumber || !isPhoneValid || isSendingOtp}
                className="w-full"
              >
                {isSendingOtp ? "Sending OTP..." : "Send OTP to WhatsApp"}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <ShieldCheckIcon className="size-4 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-900 dark:text-green-100">
                    OTP sent to {fullPhoneNumber}. Check your WhatsApp.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Enter OTP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otpInput}
                      onChange={(e) => onOtpInputChange(e.target.value.replace(/\D/g, ""))}
                    />
                    <Button
                      type="button"
                      onClick={onVerifyOtp}
                      disabled={otpInput.length !== 6 || isVerifyingOtp}
                    >
                      {isVerifyingOtp ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSendOtp}
                  disabled={isSendingOtp}
                  className="w-full"
                >
                  {isSendingOtp ? "Resending..." : "Resend OTP"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <ShieldCheckIcon className="size-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                Phone Number Verified
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {fullPhoneNumber}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
