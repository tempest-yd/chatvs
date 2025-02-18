interface Module {
    id: string;
    content: string;
}

export function extractCodeAndText(input: string): Module[] {
    const modules: Module[] = [];
    
    // Split the input into modules using the delimiter '###'
    const moduleSections = input.split('###').filter(section => section.trim().length > 0);

    for (let section of moduleSections) {
        const module: Module = {
            id: '',
            content: ''
        };

        // Split the section into lines
        const lines = section.trim().split('&&&');
        if (lines.length >= 2) {
            // Extracting id
            const namePart = lines[0].trim();
            if (namePart) {
                const nameSplit = namePart.split(':');
                if (nameSplit.length > 1) {
                    module.id = nameSplit[1].trim();
                }
            }

            // Extracting content
            const contentPart = lines[1].trim();
            if (contentPart) {
                const contentSplit = contentPart.split(':');
                if (contentSplit.length > 1) {
                    module.content = contentSplit.slice(1).join(':').trim();
                }
            }

            modules.push(module);
        }
    }

    return modules;
}