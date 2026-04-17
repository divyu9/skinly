import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { MobileHeader } from "@/components/mobile-header.tsx";
import { MobileNav } from "@/components/mobile-nav.tsx";
import { AnnouncementBar } from "@/components/announcement-bar.tsx";
import { SiteFooter } from "@/components/site-footer.tsx";

export default function TermsOfService() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Terms of Service | GoSkinly</title>
        <meta name="description" content="Read GoSkinly's terms of service. Understand your rights and our policies when shopping for vinyl device skins." />
        <link rel="canonical" href="https://www.goskinly.com/policies/terms" />
      </Helmet>
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
          <h1 className="text-4xl md:text-5xl font-black mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: December 2024</p>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
              <p className="mb-4">Welcome to Skinly ("Company", "we", "our", "us")!</p>
              <p className="mb-4">These Terms of Service ("Terms", "Terms of Service") govern your use of our website located at goskinly.com (together or individually "Service") operated by Mad House Media.</p>
              <p className="mb-4">Your agreement with us includes these Terms and our Privacy Policy ("Agreements"). You acknowledge that you have read and understood Agreements, and agree to be bound by them.</p>
              <p className="mb-4">If you do not agree with (or cannot comply with) Agreements, then you may not use the Service, but please let us know by emailing at <a href="mailto:hello@goskinly.com" className="text-primary hover:underline">hello@goskinly.com</a> so we can try to find a solution.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. Communications</h2>
              <p className="mb-4">By using our Service, you agree to subscribe to newsletters, marketing or promotional materials and other information we may send. However, you may opt out of receiving any, or all, of these communications from us by following the unsubscribe link or by emailing at <a href="mailto:hello@goskinly.com" className="text-primary hover:underline">hello@goskinly.com</a></p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. Purchases</h2>
              <p className="mb-4">If you wish to purchase any product or service made available through Service ("Purchase"), you may be asked to supply certain information relevant to your Purchase including but not limited to, your credit or debit card number, the expiration date of your card, your billing address, and your shipping information.</p>
              <p className="mb-4">You represent and warrant that: (i) you have the legal right to use any card(s) or other payment method(s) in connection with any Purchase; and that (ii) the information you supply to us is true, correct and complete.</p>
              <p className="mb-4">We use PhonePe as our payment processor for secure payment processing. By submitting your payment information, you grant us the right to provide the information to PhonePe subject to our Privacy Policy.</p>
              <p className="mb-4">We reserve the right to refuse or cancel your order at any time for reasons including but not limited to: product or service availability, errors in the description or price of the product or service, error in your order or other reasons.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. Custom Designs</h2>
              <p className="mb-4">Skinly offers custom phone skin design services that allow you to create personalized designs for your phone skins and cases.</p>
              
              <h3 className="text-xl font-semibold mb-3">4.1 Design Submission and Usage:</h3>
              <p className="mb-4">When you submit a custom design, you represent and warrant that:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>You own the intellectual property rights to the design or have permission to use all content within the design</li>
                <li>The design does not infringe upon any third-party intellectual property rights</li>
                <li>The design does not contain any unlawful, defamatory, obscene, or otherwise objectionable content</li>
                <li>The design complies with all applicable laws and regulations</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">4.2 Design Review:</h3>
              <p className="mb-4">We reserve the right to review all custom designs before production. We may refuse to produce any design that violates these Terms or appears to infringe upon intellectual property rights, contains explicit content, or violates any laws.</p>

              <h3 className="text-xl font-semibold mb-3">4.3 Design Ownership:</h3>
              <p className="mb-4">You retain ownership of your original design. However, by submitting your design to Skinly, you grant us a non-exclusive license to use, reproduce, and display your design solely for the purpose of fulfilling your order and providing our services.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. Refunds and Returns</h2>
              <h3 className="text-xl font-semibold mb-3">5.1 No Refund Policy:</h3>
              <p className="mb-4">Skinly does not have a refund policy. All purchases are final and non-refundable. Once a product has been shipped and delivered, it cannot be returned for a refund.</p>

              <h3 className="text-xl font-semibold mb-3">5.2 Replacements for Defective Products:</h3>
              <p className="mb-4">If you receive a defective product due to manufacturing defects, printing errors, or damage caused by us, you may request a replacement at no additional cost. Defective products must be reported within 7 days of delivery with photographic evidence of the defect.</p>

              <h3 className="text-xl font-semibold mb-3">5.3 Custom Designs:</h3>
              <p className="mb-4">Custom designs that have been produced according to your specifications cannot be replaced or refunded unless they are defective or the product is unfulfillable by us.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">6. Prohibited Uses</h2>
              <p className="mb-4">You may use Service only for lawful purposes and in accordance with Terms. You agree not to use Service:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>In any way that violates any applicable national or international law or regulation</li>
                <li>For the purpose of exploiting, harming, or attempting to exploit or harm minors in any way</li>
                <li>To transmit any advertising or promotional material, including any "junk mail", "chain letter," "spam," or any other similar solicitation</li>
                <li>To impersonate or attempt to impersonate Company, a Company employee, another user, or any other person or entity</li>
                <li>In any way that infringes upon the rights of others, or in any way is illegal, threatening, fraudulent, or harmful</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">7. Intellectual Property</h2>
              <p className="mb-4">The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of Mad House Media and its licensors.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">8. Limitation of Liability</h2>
              <p className="mb-4">In no event shall Mad House Media, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
              <p className="mb-4">If you have any questions about these Terms, please contact us:</p>
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
