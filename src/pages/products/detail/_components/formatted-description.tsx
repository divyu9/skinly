interface FormattedDescriptionProps {
  description: string;
}

export function FormattedDescription({ description }: FormattedDescriptionProps) {
  // Convert markdown-like formatting to HTML
  const formatDescription = (text: string): string => {
    if (!text) return '';
    
    let formatted = text;
    
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Convert line breaks to <br> but preserve paragraph spacing
    // Split by double line breaks first to create paragraphs
    const paragraphs = formatted.split(/\n\n+/);
    
    // Process each paragraph
    const processedParagraphs = paragraphs.map(para => {
      // Replace single line breaks with <br>
      const withBreaks = para.replace(/\n/g, '<br>');
      // Wrap in paragraph tags
      return `<p class="mb-4">${withBreaks}</p>`;
    });
    
    return processedParagraphs.join('');
  };

  const formattedHTML = formatDescription(description);

  return (
    <div 
      className="prose prose-sm max-w-none text-muted-foreground [&_strong]:font-bold [&_strong]:text-foreground [&_em]:italic [&_p]:leading-relaxed"
      dangerouslySetInnerHTML={{ __html: formattedHTML }}
    />
  );
}
