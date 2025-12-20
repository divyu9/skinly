interface FormattedDescriptionProps {
  description: string;
}

export function FormattedDescription({ description }: FormattedDescriptionProps) {
  // Parse HTML and format it properly
  // This component renders HTML description with proper paragraph spacing
  return (
    <div 
      className="prose prose-sm max-w-none text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: description }}
    />
  );
}
