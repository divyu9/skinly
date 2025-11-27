import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { CheckCircle2Icon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function ProductConfirmPage() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const brandFilter = urlParams.get('brand');
  const modelFilter = urlParams.get('model');

  // Redirect to home if no brand/model
  if (!brandFilter || !modelFilter) {
    window.location.href = '/';
    return null;
  }

  const handleFinishSelect = (finish: string) => {
    navigate(`/products?brand=${encodeURIComponent(brandFilter)}&model=${encodeURIComponent(modelFilter)}&finish=${finish}`);
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://cdn.hercules.app/file_Qd06a0OWqeC2LadTl4tLLvmv" 
              alt="Skinly" 
              className="h-16"
            />
          </Link>
          <Button size="sm" variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </nav>

      {/* Confirmation Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Success Message */}
          <div className="text-center mb-16 space-y-6">
            <div className="inline-block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-2xl"></div>
                <div className="relative size-24 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                  <CheckCircle2Icon className="size-14 text-white" />
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-6xl font-bold text-balance bg-gradient-to-br from-primary via-secondary to-accent bg-clip-text text-transparent">
                We've Got You Covered!
              </h1>
              <p className="text-2xl lg:text-3xl text-foreground font-semibold">
                Your {modelFilter} is available!
              </p>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Choose your preferred finish style below to see all compatible designs
              </p>
            </div>
          </div>

          {/* Finish Categories */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 lg:gap-8">
            {/* Matte Finish */}
            <Card 
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-primary transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
              onClick={() => handleFinishSelect('matte')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-cyan-50 dark:from-pink-950/20 dark:to-cyan-950/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold rounded-full shadow-lg">
                CLASSIC
              </div>
              <CardContent className="relative pt-12 pb-8 space-y-6 text-center">
                <div className="size-28 mx-auto bg-gradient-to-br from-pink-100 to-cyan-100 dark:from-pink-900/30 dark:to-cyan-900/30 rounded-3xl flex items-center justify-center text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  🎨
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold">Matte Finish</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Smooth, velvety texture with zero glare. Perfect for grip and that premium feel.
                  </p>
                </div>
                <Button className="w-full h-12 text-base font-semibold" size="lg">
                  Choose Matte →
                </Button>
              </CardContent>
            </Card>

            {/* 3D Embossed Finish */}
            <Card 
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-secondary transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
              onClick={() => handleFinishSelect('embossed')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-orange-50 dark:from-purple-950/20 dark:to-orange-950/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute top-4 right-4 bg-secondary text-secondary-foreground px-4 py-1.5 text-xs font-bold rounded-full shadow-lg">
                PREMIUM
              </div>
              <CardContent className="relative pt-12 pb-8 space-y-6 text-center">
                <div className="size-28 mx-auto bg-gradient-to-br from-purple-100 to-orange-100 dark:from-purple-900/30 dark:to-orange-900/30 rounded-3xl flex items-center justify-center text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  ✨
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold">3D Embossed</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Raised textures you can feel. Touch meets art in the most satisfying way.
                  </p>
                </div>
                <Button className="w-full h-12 text-base font-semibold" size="lg" variant="secondary">
                  Choose 3D Embossed →
                </Button>
              </CardContent>
            </Card>

            {/* Transparent Finish */}
            <Card 
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-accent transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
              onClick={() => handleFinishSelect('transparent')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-950/20 dark:to-teal-950/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-4 py-1.5 text-xs font-bold rounded-full shadow-lg">
                SLEEK
              </div>
              <CardContent className="relative pt-12 pb-8 space-y-6 text-center">
                <div className="size-28 mx-auto bg-gradient-to-br from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 rounded-3xl flex items-center justify-center text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  💎
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold">Transparent</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Show off your phone's original color with our crystal-clear protective layer.
                  </p>
                </div>
                <Button className="w-full h-12 text-base font-semibold" size="lg" variant="outline">
                  Choose Transparent →
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
