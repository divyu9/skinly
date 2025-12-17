import { useParams } from "react-router-dom";
import SEOPage from "./page.tsx";

/**
 * Handler for keyword-type SEO pages that use root-level slugs
 * This catches URLs like /phone-skins, /best-skins, etc.
 */
export default function KeywordPageHandler() {
  const { "*": slug } = useParams();
  
  // Remove leading slash if present
  const cleanSlug = slug?.replace(/^\//, "") || "";
  
  // Pass the slug as a URL param to SEOPage
  return <SEOPage />;
}
