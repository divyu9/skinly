import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { BugIcon } from "lucide-react";
import { useState } from "react";
import { BugReportModal } from "./bug-report-modal.tsx";
import { BrandLogo } from "./brand-logo.tsx";

export function SiteFooter() {
  const [bugReportOpen, setBugReportOpen] = useState(false);

  return (
    <>
      <footer className="py-8 px-4 bg-white border-t">
        <div className="container mx-auto max-w-7xl">
          {/* Main Footer Content */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-6">
            {/* Logo & Tagline */}
            <div className="flex flex-col items-center md:items-start md:max-w-xs">
              <BrandLogo type="footer" className="mb-2" imgClassName="h-10 md:h-12 w-auto" />
              <p className="text-sm text-muted-foreground text-center md:text-left">
                Quirky wear for your gadgets
              </p>
            </div>

            {/* Links Grid - Compact 4 columns on desktop, 2 on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 flex-1 max-w-3xl">
              {/* Shop */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Shop</h3>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <Link to="/products" className="text-muted-foreground hover:text-primary transition-colors">
                      All Products
                    </Link>
                  </li>
                  <li>
                    <Link to="/products?filter=new" className="text-muted-foreground hover:text-primary transition-colors">
                      New Arrivals
                    </Link>
                  </li>
                  <li>
                    <Link to="/products?filter=best" className="text-muted-foreground hover:text-primary transition-colors">
                      Best Sellers
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Support</h3>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <Link to="/orders" className="text-muted-foreground hover:text-primary transition-colors">
                      Track Order
                    </Link>
                  </li>
                  <li>
                    <Link to="/policies/returns" className="text-muted-foreground hover:text-primary transition-colors">
                      Returns
                    </Link>
                  </li>
                  <li>
                    <Link to="/policies/shipping" className="text-muted-foreground hover:text-primary transition-colors">
                      Shipping
                    </Link>
                  </li>
                  <li>
                    <Link to="/devices" className="text-muted-foreground hover:text-primary transition-colors">
                      Request Model
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Company</h3>
                <ul className="space-y-1.5 text-sm">
                  <li>
                    <Link to="/policies/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link to="/policies/terms" className="text-muted-foreground hover:text-primary transition-colors">
                      Terms
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h3 className="font-semibold text-sm mb-2">Contact</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <a href="mailto:hello@goskinly.com" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <svg className="size-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Email Us</span>
                  </a>
                  <a href="https://wa.me/917505273504" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <svg className="size-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                  <div className="text-xs leading-relaxed pt-1">
                    <p className="font-medium text-foreground">Mad House Media</p>
                    <p>GT-06, 2nd Floor</p>
                    <p>Sector 117, Noida 201301</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t text-xs text-muted-foreground">
            <div className="text-center md:text-left">
              © {new Date().getFullYear()} Mad House Media. All rights reserved.
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBugReportOpen(true)}
              className="text-muted-foreground hover:text-primary h-8 text-xs"
            >
              <BugIcon className="size-3.5 mr-1.5" />
              Report a Bug
            </Button>
          </div>
        </div>
      </footer>

      {/* Bug Report Modal */}
      <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </>
  );
}
