import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { ShieldCheckIcon, SparklesIcon, PackageIcon, TruckIcon } from "lucide-react";

export default function Index() {
  const features = [
    {
      icon: ShieldCheckIcon,
      title: "Tough as Nails",
      description: "Your phone's new BFF. We protect against drops, bumps, and life's little accidents"
    },
    {
      icon: SparklesIcon,
      title: "Weirdly Wonderful",
      description: "From cosmic cats to dancing tacos, our designs are as unique as your personality"
    },
    {
      icon: PackageIcon,
      title: "Fits Like a Glove",
      description: "Snug fit for every button, port, and camera. No awkward gaps here"
    },
    {
      icon: TruckIcon,
      title: "Lightning Fast",
      description: "Free shipping, always. Your new phone vibe arrives in 2-3 days"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
            <span className="text-xl font-bold">SkinStudio</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#products" className="text-sm font-medium hover:text-primary transition-colors">
              Shop
            </a>
            <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">
              About
            </a>
            <Button size="sm">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block">
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                  ✨ New Quirky Drops
                </div>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-balance leading-tight">
                Boring Phones?
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  {" "}Not On Our Watch!
                </span>
              </h1>
              <p className="text-xl text-muted-foreground text-balance max-w-xl">
                Wildly creative phone skins that'll make your friends jealous. 
                Why blend in when you were born to stand out?
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="text-base">
                  Browse Collection
                </Button>
                <Button size="lg" variant="secondary" className="text-base">
                  Custom Design
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold">10K+</div>
                  <div className="text-sm text-muted-foreground">Happy Customers</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-muted-foreground">Unique Designs</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="text-3xl font-bold">4.9★</div>
                  <div className="text-sm text-muted-foreground">Average Rating</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl" />
              <img 
                src="https://images.unsplash.com/photo-1576110771045-a7711d8aab8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw0fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Colorful phone cases"
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Why We're Different
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              Because your phone deserves more than another boring case
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-all hover:shadow-lg">
                <CardContent className="pt-6 space-y-4">
                  <div className="size-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-bold text-balance">
              Fan Favorites
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
              The designs everyone's obsessed with right now
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              "https://images.unsplash.com/photo-1582000129759-dc56c7b45cde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw5fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703781874-ffa0c5de09aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636703782057-cdda1439bc2c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwzfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1743670827800-61375c99e7a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw2fHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1580013989584-8c3aa8b17263?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwyfHxjb2xvcmZ1bCUyMHBob25lJTIwY2FzZXMlMjBza2lucyUyMG1vZGVybnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1636267863852-a4897886ee2f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxMHx8Y29sb3JmdWwlMjBwaG9uZSUyMGNhc2VzJTIwc2tpbnMlMjBtb2Rlcm58ZW58MHx8fHwxNjYzNzIxMjUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1731039918160-a26b2b9ff126?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw4fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
              "https://images.unsplash.com/photo-1744646355003-2f61f09b9f18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw3fHxzbWFydHBob25lJTIwcHJvdGVjdGlvbiUyMHRyZW5keSUyMGRlc2lnbnxlbnwwfHx8fDE3NjM3MjEyNTF8MA&ixlib=rb-4.1.0&q=80&w=1080"
            ].map((image, index) => (
              <div key={index} className="group relative aspect-square overflow-hidden rounded-xl">
                <img 
                  src={image} 
                  alt={`Phone skin design ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
            <CardContent className="relative py-16 text-center space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-balance">
                Your Phone Called. It Wants Personality.
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
                Join 10,000+ happy humans who ditched boring for bold
              </p>
              <div className="flex flex-wrap gap-4 justify-center pt-4">
                <Button size="lg" className="text-base">
                  Shop Now
                </Button>
                <Button size="lg" variant="outline" className="text-base">
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="size-8 bg-gradient-to-br from-primary via-secondary to-accent rounded-lg" />
                <span className="text-xl font-bold">SkinStudio</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Where quirky meets quality
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Shop</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">All Products</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Best Sellers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Shipping Info</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Returns</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} SkinStudio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
