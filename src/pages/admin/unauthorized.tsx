import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { ShieldXIcon } from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { Link } from "react-router-dom";

export default function UnauthorizedPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950 p-4">
      <Card className="w-full max-w-lg border-2">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <ShieldXIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            {user ? (
              <>
                You do not have administrator privileges to access this area.
                <br />
                <span className="text-sm mt-2 block">
                  If you believe this is an error, please contact your system administrator.
                </span>
              </>
            ) : (
              <>
                You must sign in with an administrator account to access this area.
              </>
            )}
          </p>
          <div className="flex flex-col gap-3">
            {user ? (
              <Button asChild variant="default" size="lg">
                <Link to="/">Go to Homepage</Link>
              </Button>
            ) : (
              <SignInButton size="lg" className="w-full" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
