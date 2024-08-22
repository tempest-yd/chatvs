export function ex(input: string): {  content: string, lan: string } {
    let segments: { content: string, lan: string } ={ content: "", lan: "" }
    const regex = /```(\w*)\n([\s\S]*?)\n```/g;
    let match;
    let currentIndex = 0;

    while ((match = regex.exec(input)) !== null) {

        const language = match[1];
        const code = match[2];
        segments = { content: code, lan: language };
        currentIndex = regex.lastIndex;
    }

    return segments;
}
