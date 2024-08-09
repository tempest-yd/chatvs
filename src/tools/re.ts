export function extractCodeAndText(input: string): { type: string, content: string, lan: string }[] {
    const segments: { type: string, content: string, lan: string }[] = [];
    const regex = /```(\w*)\n([\s\S]*?)\n```/g;
    let match;
    let currentIndex = 0;

    while ((match = regex.exec(input)) !== null) {
        const precedingText = input.substring(currentIndex, match.index).trim();
        if (precedingText.length > 0) {
            segments.push({ type: 'text', content: precedingText, lan: '' });
        }

        const language = match[1];
        const code = match[2];
        segments.push({ type: 'code', content: code, lan: language });

        currentIndex = regex.lastIndex;
    }

    // Check for any remaining text after the last code segment
    if (currentIndex < input.length) {
        const remainingText = input.substring(currentIndex).trim();
        if (remainingText.length > 0) {
            segments.push({ type: 'text', content: remainingText, lan: '' });
        }
    }

    return segments;
}
