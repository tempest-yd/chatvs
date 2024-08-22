interface Module {
    module: string;
    functionality: string[];
    pseudoCode: string;
}
export function extractCodeAndText(input: string):Module[] {
    const modules: Module[] = [];
    
    // Split the input into modules using the delimiter '%%%'
    const moduleSections = input.split('###').filter(section => section.trim().length > 0);

    for (let section of moduleSections) {
        section = "###" + section
        const module: Module = {
            module: '',
            functionality: [],
            pseudoCode: ''
        };

        // Split the section into lines
        const lines = section.trim().split('@@@');
        if(lines.length == 2){
            lines[1] = lines[1].trim().split('&&&')[0]
            lines[1] = "@@@"+lines[1] 
            lines.push(section.trim().split('&&&')[1])
            lines[2] = "&&&"+lines[2] 

            for (const line of lines) {
                if (line.startsWith('###')) {
                    const namePart = line.slice(3).trim();
                    const nameSplit = namePart.split(':');
                    if (nameSplit.length > 1) {
                        module.module = nameSplit[1].trim();
                    }
                } else if (line.startsWith('@@@')) {
                    const functionalityPart = line.slice(3).trim();
                    const functionalitySplit = functionalityPart.split(':');
                    if (functionalitySplit.length > 1) {
                        module.functionality.push(functionalitySplit[1].trim());
                    }
                } else if (line.startsWith('&&&')) {
                    const pseudoCodePart = line.slice(3).trim();
                    const pseudoCodeSplit = pseudoCodePart.split(':');
                    if (pseudoCodeSplit.length > 1) {
                        
                        module.pseudoCode = pseudoCodeSplit.slice(1).join('');
                        const a = module.pseudoCode.split('```')
                        module.pseudoCode = a[1]
                    }
                }
            }
            modules.push(module);
        }

    }

    return modules;

}
