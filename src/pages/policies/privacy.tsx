import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-black mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: December 2024</p>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Who We Are</h2>
              <p className="mb-4">Our website address is: <a href="https://goskinly.com" className="text-primary hover:underline">https://goskinly.com</a></p>
              <p className="mb-4">Skinly is operated by Mad House Media, located at: GT-06, 2nd Floor, Sector 117, Noida - 201304, India</p>
              <p className="mb-4">For privacy-related inquiries or support, you can reach us at:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Email: <a href="mailto:hello@goskinly.com" className="text-primary hover:underline">hello@goskinly.com</a></li>
                <li>WhatsApp Support: <a href="https://wa.me/917505273504" className="text-primary hover:underline">+91 7505273504</a></li>
              </ul>
              <p className="mb-4">Skinly specializes in custom phone skins and cases with personalized design capabilities across thousands of phone models.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Data We Collect</h2>
              <p className="mb-4">We collect the following types of data:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Order Information:</strong> Name, email address, shipping address, phone number, and order history</li>
                <li><strong>Account Information:</strong> Username, password (encrypted), email address, and user preferences</li>
                <li><strong>Design Data:</strong> Custom designs, design files, and customization choices you create</li>
                <li><strong>Review Information:</strong> Review content, rating, and verified purchase status</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, and access logs</li>
                <li><strong>Communication Data:</strong> Customer service inquiries, emails, and WhatsApp messages</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Custom Designs and Website Infrastructure</h2>
              <p className="mb-4">Skinly allows customers to upload and create custom designs for their phone skins through our proprietary API-based design system. Our custom design tools are built and hosted on our website infrastructure, giving you complete control over your design data.</p>
              <p className="mb-4">When you use our custom design features:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Design files and customization data are processed and stored through our own secure API system</li>
                <li>Your design data is maintained on our infrastructure without reliance on external third-party design platforms</li>
                <li>We may use cookies to maintain your design session and save your customization preferences</li>
                <li>Design data is retained for the duration of your order and may be kept for customer service and potential reordering purposes</li>
                <li>Your design files remain your intellectual property, and you have the right to request deletion after a specified retention period</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Cookies</h2>
              <p className="mb-4">Our website uses cookies for the following purposes:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Login and Account Cookies:</strong> If you create an account on our website, we set cookies to save your login information and preferences. Login cookies last for two days.</li>
                <li><strong>Preference Cookies:</strong> We use cookies to save your display and interface preferences. These cookies last for one year.</li>
                <li><strong>Session Cookies:</strong> When you add items to your cart or proceed through checkout, session cookies maintain your shopping session information.</li>
                <li><strong>Analytics and Tracking Cookies:</strong> We use Google Analytics and Meta Pixel to track user behavior, analyze website performance, and measure the effectiveness of our marketing campaigns.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Payment Processing</h2>
              <p className="mb-4">When you make a purchase on Skinly, your payment information is processed securely through PhonePe. We do not store complete credit card or payment details on our servers. PhonePe retains transaction data according to their privacy policy and PCI compliance requirements.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Who We Share Your Data With</h2>
              <p className="mb-4">We share your personal data with:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Payment Processors:</strong> PhonePe for processing payments</li>
                <li><strong>Shipping Partners:</strong> Delhivery, Blue Dart, Ekart, SpeedPost for order fulfillment</li>
                <li><strong>Communication Services:</strong> WhatsApp Business API for order updates and customer support</li>
                <li><strong>Analytics Providers:</strong> Google Analytics and Meta for website analytics and marketing</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Your Data Rights</h2>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Request access to your personal data</li>
                <li>Request correction of your personal data</li>
                <li>Request deletion of your personal data</li>
                <li>Object to processing of your personal data</li>
                <li>Request restriction of processing your personal data</li>
                <li>Request transfer of your personal data</li>
                <li>Withdraw consent</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Data Security</h2>
              <p className="mb-4">We implement appropriate technical and organizational security measures to protect your personal data against unauthorized or unlawful processing, accidental loss, destruction, or damage.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
              <p className="mb-4">For any questions about this Privacy Policy, please contact us:</p>
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
