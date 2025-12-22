import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";

export default function ShippingPolicy() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Announcement Bar */}
      <AnnouncementBar />
      
      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />

      {/* Mobile Navigation Sheet */}
      <MobileNav 
        open={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-32 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="size-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Shipping Policy</h1>
          <p className="text-muted-foreground">Last Updated: December 2024</p>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. Overview</h2>
              <p className="mb-4">Skinly is committed to delivering your custom phone skins and products safely and efficiently to your doorstep. Our easy-to-understand Shipping Policy outlines all details regarding delivery, shipping timelines, and what to expect during the shipping process.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. Shipping Coverage</h2>
              <h3 className="text-xl font-semibold mb-3">2.1 Pan-India Delivery:</h3>
              <p className="mb-4">We deliver to all locations across India, including metros, tier-2 cities, and remote areas.</p>

              <h3 className="text-xl font-semibold mb-3">2.2 International Shipping:</h3>
              <p className="mb-4">We do not currently offer international shipping. All deliveries are restricted to addresses within India only.</p>

              <h3 className="text-xl font-semibold mb-3">2.3 Delivery Restrictions:</h3>
              <p className="mb-4">We are unable to deliver to P.O. Box addresses, military bases, or certain restricted areas. If your pincode falls in a restricted delivery zone, we will notify you before processing your order.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. Shipping Partners</h2>
              <p className="mb-4">We have partnered with India's most reliable and efficient logistics providers to ensure your orders reach you safely and on time:</p>
              
              <h3 className="text-xl font-semibold mb-3">3.1 Primary Partners:</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Delhivery</li>
                <li>Blue Dart</li>
                <li>Ekart (Flipkart Logistics)</li>
                <li>SpeedPost (India Post)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">3.2 Partner Selection:</h3>
              <p className="mb-4">We utilize an AI-powered system to automatically select the most suitable courier partner for your specific pincode and delivery location. This ensures optimal delivery speed, reliability, and safety for your package.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. Delivery Timeline</h2>
              <h3 className="text-xl font-semibold mb-3">4.1 Processing Time:</h3>
              <p className="mb-4">After you place your order, we typically process and prepare your package for shipment within 2-3 business days. For custom design orders, processing may take an additional 1-2 business days depending on design complexity and our current order volume.</p>

              <h3 className="text-xl font-semibold mb-3">4.2 Standard Delivery Time:</h3>
              <p className="mb-4">Once dispatched from our warehouse, standard delivery typically takes 4-6 working days, depending on your location and the assigned courier service.</p>

              <h3 className="text-xl font-semibold mb-3">4.3 Business Days:</h3>
              <p className="mb-4">Delivery timelines are calculated in working/business days (Monday-Friday), excluding public holidays and weekends.</p>

              <h3 className="text-xl font-semibold mb-3">4.4 Peak Season Delays:</h3>
              <p className="mb-4">During festive seasons, sales events, or high-order volumes, delivery timelines may extend by 2-3 additional business days. We will notify customers of any expected delays.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. Order Confirmation and Tracking</h2>
              <h3 className="text-xl font-semibold mb-3">5.1 Order Confirmation:</h3>
              <p className="mb-4">Once your order is successfully placed, you will receive an order confirmation message on WhatsApp (if you have provided an eligible WhatsApp number during checkout).</p>

              <h3 className="text-xl font-semibold mb-3">5.2 Dispatch Notification:</h3>
              <p className="mb-4">When your product is dispatched from our warehouse, you will receive a WhatsApp message containing the courier name, tracking number, and a tracking link.</p>

              <h3 className="text-xl font-semibold mb-3">5.3 Tracking Your Order:</h3>
              <p className="mb-4">You can track your shipment in real-time using the provided tracking number and link. Tracking updates are typically provided by the assigned courier service.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">6. Shipping Charges</h2>
              <h3 className="text-xl font-semibold mb-3">6.1 Shipping Cost Calculation:</h3>
              <p className="mb-4">Shipping charges are calculated based on your delivery location (pincode) and the weight of your order during checkout.</p>

              <h3 className="text-xl font-semibold mb-3">6.2 Free Shipping:</h3>
              <p className="mb-4">Free shipping may be available on orders above a certain value or during promotional offers. Check the website for current offers.</p>

              <h3 className="text-xl font-semibold mb-3">6.3 Non-Refundable:</h3>
              <p className="mb-4">Shipping charges are non-refundable and will not be reversed even if your order is cancelled, refused, or returned.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">7. Contact Us</h2>
              <p className="mb-4">For any questions about our Shipping Policy, please contact us:</p>
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
      
      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
