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
              src="/logo.webp" 
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
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-primary transition-all duration-300 hover:shadow-xl"
              onClick={() => handleFinishSelect('matte')}
            >
              <CardContent className="p-0">
                {/* Image */}
                <div className="relative aspect-square w-full overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1657935937312-1ad849214aea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
                    alt="Matte Finish Texture"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 text-[8px] sm:text-xs font-bold rounded-full">
                    CLASSIC
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-2 sm:p-3 md:p-4 lg:p-6 space-y-1 sm:space-y-2 md:space-y-3 text-center">
                  <h3 className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold leading-tight">Matte</h3>
                  <p className="text-[8px] sm:text-xs md:text-sm text-muted-foreground leading-snug hidden sm:block">
                    Smooth & velvety
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3D Embossed Finish */}
            <Card 
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-secondary transition-all duration-300 hover:shadow-xl"
              onClick={() => handleFinishSelect('embossed')}
            >
              <CardContent className="p-0">
                {/* Image */}
                <div className="relative aspect-square w-full overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1567642704760-475ed58df1e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
                    alt="3D Embossed Texture"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2 bg-secondary text-secondary-foreground px-2 py-1 text-[8px] sm:text-xs font-bold rounded-full">
                    PREMIUM
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-2 sm:p-3 md:p-4 lg:p-6 space-y-1 sm:space-y-2 md:space-y-3 text-center">
                  <h3 className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold leading-tight">3D Embossed</h3>
                  <p className="text-[8px] sm:text-xs md:text-sm text-muted-foreground leading-snug hidden sm:block">
                    Raised & tactile
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Transparent Finish */}
            <Card 
              className="group cursor-pointer relative overflow-hidden border-2 hover:border-accent transition-all duration-300 hover:shadow-xl"
              onClick={() => handleFinishSelect('transparent')}
            >
              <CardContent className="p-0">
                {/* Image */}
                <div className="relative aspect-square w-full overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1753522222838-3dd35017ea15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400"
                    alt="Transparent Crystal"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-2 py-1 text-[8px] sm:text-xs font-bold rounded-full">
                    SLEEK
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-2 sm:p-3 md:p-4 lg:p-6 space-y-1 sm:space-y-2 md:space-y-3 text-center">
                  <h3 className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-bold leading-tight">Transparent</h3>
                  <p className="text-[8px] sm:text-xs md:text-sm text-muted-foreground leading-snug hidden sm:block">
                    Crystal clear
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
