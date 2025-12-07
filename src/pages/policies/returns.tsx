import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";

export default function ReturnsPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-12 md:h-16"
            />
          </Link>
          <MobileNav />
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-32 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="size-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Returns & Replacement Policy</h1>
          <p className="text-muted-foreground">Last Updated: December 2024</p>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. Policy Overview</h2>
              <p className="mb-4">Skinly is committed to ensuring your satisfaction with every purchase. This Returns and Replacement Policy outlines the conditions, procedures, and timelines for returning or exchanging products.</p>
              <p className="mb-4">Our returns policy provides a <strong>48-hour window</strong> from the time of delivery for you to initiate a return or exchange request. After this 48-hour window, we cannot offer refunds or exchanges.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. Return Eligibility</h2>
              <p className="mb-4">You are eligible for a return or exchange under the following conditions:</p>
              
              <h3 className="text-xl font-semibold mb-3">2.1 Eligible Return Reasons:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Wrong product sent by us</li>
                <li>Missing product in the package</li>
                <li>Partial product received</li>
                <li>Damaged product received (due to our error or manufacturing defect)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">2.2 Ineligible Returns:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Used products with wear and tear</li>
                <li>Products used, worn, or applied after delivery</li>
                <li>Items not in original packaging</li>
                <li>Products returned outside the 48-hour return window</li>
                <li>Custom designs that have been produced to your specifications</li>
                <li>Sale items or discounted products</li>
                <li>Products purchased during clearance or liquidation sales</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">2.3 Return Window:</h3>
              <p className="mb-4">The 48-hour return window begins from the date and time of delivery. After this period expires, return requests will not be accepted.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. Return Conditions</h2>
              <p className="mb-4">To be eligible for a return, your item must meet ALL of the following conditions:</p>
              
              <h3 className="text-xl font-semibold mb-3">3.1 Unused and Unapplied:</h3>
              <p className="mb-4">The product must be completely unused and not applied to any device.</p>

              <h3 className="text-xl font-semibold mb-3">3.2 Original Condition:</h3>
              <p className="mb-4">The item must be in the same condition as when you received it, with no signs of use, wear, tear, or damage (except damage caused by us or our courier).</p>

              <h3 className="text-xl font-semibold mb-3">3.3 Original Packaging:</h3>
              <p className="mb-4">The product must be in its original, unopened packaging. If the package has been opened, the item becomes ineligible for return.</p>

              <h3 className="text-xl font-semibold mb-3">3.4 Documentation:</h3>
              <p className="mb-4">You must provide valid documentation including receipt or proof of purchase (order confirmation email) and photos of the product and packaging if claiming damage or defect.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. How to Initiate a Return</h2>
              <ol className="list-decimal pl-6 mb-4 space-y-2">
                <li>Contact our support team within 48 hours of delivery via WhatsApp at <a href="https://wa.me/917505273504" className="text-primary hover:underline">+91 7505273504</a> or email at <a href="mailto:hello@goskinly.com" className="text-primary hover:underline">hello@goskinly.com</a></li>
                <li>Provide your order number, reason for return, and supporting documentation (photos if applicable)</li>
                <li>Our team will review your request within 24-48 hours</li>
                <li>If approved, we will provide you with return instructions and shipping label (if applicable)</li>
              </ol>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. Refund Process</h2>
              <p className="mb-4">Once your return is approved and we receive the returned product:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>We will inspect the product to ensure it meets return conditions</li>
                <li>Refunds will be processed within 7-10 business days</li>
                <li>Refunds will be issued to the original payment method</li>
                <li>Shipping charges are non-refundable</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">6. Exchanges</h2>
              <p className="mb-4">If you received a wrong or defective product, we will exchange it at no additional cost. The exchange process follows the same timeline and conditions as returns.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">7. Contact Us</h2>
              <p className="mb-4">For any questions about our Returns and Replacement Policy, please contact us:</p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-semibold mb-2">Mad House Media</p>
                <p className="mb-1">GT-06, 2nd Floor, Sector 117, Noida - 201304</p>
                <p className="mb-1">Email: <a href="mailto:hello@goskinly.com" className="text-primary hover:underline">hello@goskinly.com</a></p>
                <p>WhatsApp: <a href="https://wa.me/917505273504" className="text-primary hover:underline">+91 7505273504</a></p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
