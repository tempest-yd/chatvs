import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { remake } from '../makenew/remake';

let lineTypes: { [key: number]: number } = {};
const confirmedLines = new Set<number>();

export const confirm = (context: vscode.ExtensionContext) => {
    const editorDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: ' ✔️',
            color: '#008000',
            margin: '0 10px 0 0',
            textDecoration: 'none'
        }
    });

    const confirmButtonDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: ' ❓',
            color: '#0000FF',
            textDecoration: 'none',
            margin: '0 10px 0 0',
        }
    });

    const confirmCommand = vscode.commands.registerCommand('CodeToolBox.confirmLine', (line: number) => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const fileName = editor.document.fileName;
            const jsonFileName = fileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py_human.json');
            const jsonFilePath = path.resolve(__dirname, jsonFileName);

            // 读取 JSON 文件
            let structuredArray: { type: number, content: string }[] = [];
            try {
                const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                structuredArray = JSON.parse(jsonData);
            } catch (error) {
                //vscode.window.showErrorMessage(`Error reading JSON file: ${error}`);
                return;
            }

            const lineText = editor.document.lineAt(line).text.trim();

            // 找到与当前行内容匹配的条目并修改 type 为 1
            const index = structuredArray.findIndex(item => item.content.trim() === lineText);
            if (index !== -1) {
                structuredArray[index].type = 1;

                // 保存修改后的 JSON 文件
                try {
                    fs.writeFileSync(jsonFilePath, JSON.stringify(structuredArray, null, 2), 'utf-8');
                    vscode.window.showInformationMessage(`Line ${line + 1} confirmed and JSON updated.`);

                    // 更新 lineTypes 状态
                    lineTypes[line] = 1;
                    updateDecorations(editor);
                } catch (error) {
                    //vscode.window.showErrorMessage(`Error writing to JSON file: ${error}`);
                }
            } else {
                vscode.window.showWarningMessage(`No matching content found in JSON for line ${line + 1}.`);
            }
        }
    });

    context.subscriptions.push(confirmCommand);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const fileName = editor.document.fileName;

        // 只对 代码 文件应用装饰
        if (editor.document.fileName.endsWith('.pseudo')) {
            return;
        }

        const lineCount = editor.document.lineCount;
        const buttonRanges: vscode.DecorationOptions[] = [];
        const confirmedRanges: vscode.DecorationOptions[] = [];

        for (let i = 0; i < lineCount; i++) {
            const lineText = editor.document.lineAt(i).text;

            if (lineText.trim() === '') {
                continue; // 跳过空行
            }

            const range = new vscode.Range(i, 0, i, 0);

            // 根据 type 判断展示 confirm 按钮还是对号
            if (lineTypes[i] === 1) {
                confirmedRanges.push({ range });
            } else {
                buttonRanges.push({ range });
            }
        }

        // 设置装饰
        editor.setDecorations(confirmButtonDecorationType, buttonRanges);
        editor.setDecorations(editorDecorationType, confirmedRanges);
    };

    // 读取 human.json 文件，并初始化 lineTypes
    const loadHumanJson = (editor: vscode.TextEditor) => {
        const fileName = editor.document.fileName;
        const jsonFileName = fileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py_human.json');
        const jsonFilePath = path.resolve(__dirname, jsonFileName);

        try {
            if (fs.existsSync(jsonFilePath)) {
                const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                const structuredArray: { type: number, content: string }[] = JSON.parse(jsonData);

                // 初始化 lineTypes
                lineTypes = {};
                for (let i = 0; i < editor.document.lineCount; i++) {
                    const lineText = editor.document.lineAt(i).text.trim();
                    const index = structuredArray.findIndex(item => item.content.trim() === lineText);
                    if (index !== -1) {
                        lineTypes[i] = structuredArray[index].type; // 记录每行的 type
                    } else {
                        lineTypes[i] = 0; // 如果没找到，默认未确认
                    }
                }
            } else {
                lineTypes = {}; // 如果文件不存在，清空 lineTypes
            }
        } catch (error) {
            //vscode.window.showErrorMessage(`Error loading JSON file: ${error}`);
        }
    };

    const onLineClick = (event: vscode.TextEditorSelectionChangeEvent) => {
        const editor = event.textEditor;
        const line = editor.selection.active.line;

        if (confirmedLines.has(line)) {
            return; // 如果已确认，不处理
        }

        vscode.commands.executeCommand('CodeToolBox.confirmLine', line);
    };

    // 当激活编辑器时加载并更新装饰
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && (!editor.document.fileName.endsWith('.pseudo'))) {
            loadHumanJson(editor);
            updateDecorations(editor);
        }
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        clearCurrentDecorations();
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document && (!editor.document.fileName.endsWith('.pseudo'))) {
            loadHumanJson(editor); // 文档变化后重新加载 JSON
            updateDecorations(editor);

            // 定义human_json相关文件路径
            const humanJsonFileName = editor.document.fileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py_human.json');
            const humanJsonFilePath = path.resolve(__dirname, humanJsonFileName);
            let humanJsonArray: { type: number, content: string }[] = [];
            try {
                if (fs.existsSync(humanJsonFilePath)) {
                    const humanJsonData = fs.readFileSync(humanJsonFilePath, 'utf-8');
                    humanJsonArray = JSON.parse(humanJsonData);
                }
            } catch (error) {
                //vscode.window.showErrorMessage(`Error reading human JSON file: ${error}`);
                return; // 出现错误时不继续执行
            }

            // 检查行变化并更新第一个JSON文件（带 _py_human.json 的）
            const jsonFileName = editor.document.fileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py_human.json');
            const jsonFilePath = path.resolve(__dirname, jsonFileName);
            let structuredArray: { type: number, content: string }[] = [];
            try {
                if (fs.existsSync(jsonFilePath)) {
                    const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                    structuredArray = JSON.parse(jsonData);
                }

                const currentContent = editor.document.getText().split('\n');

                // 遍历行并更新内容
                structuredArray = structuredArray.map((item, index) => {
                    const lineContent = currentContent[index]?.trim();

                    // 检查行内容是否与human_json文件的内容匹配
                    const existsInHumanJson = humanJsonArray.some(humanItem => humanItem.content.trim() === lineContent);

                    if (!existsInHumanJson && lineContent !== item.content.trim()) {
                        return { type: 1, content: lineContent || '' }; // 更新为变化行
                    }
                    return item; // 保持原样
                });

                // 保存更新后的JSON文件
                fs.writeFileSync(jsonFilePath, JSON.stringify(structuredArray, null, 2), 'utf-8');
            } catch (error) {
                //vscode.window.showErrorMessage(`Error writing to JSON file: ${error}`);
            }

            // 检查行变化并更新第二个JSON文件（带 _py.json 的）
            const jsonFileName1 = editor.document.fileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py.json');
            const jsonFilePath1 = path.resolve(__dirname, jsonFileName1);
            let structuredArray1: { type: number, content: string }[] = [];
            try {
                if (fs.existsSync(jsonFilePath1)) {
                    const jsonData = fs.readFileSync(jsonFilePath1, 'utf-8');
                    structuredArray1 = JSON.parse(jsonData);
                }

                const currentContent = editor.document.getText().split('\n');

                // 遍历行并更新内容
                structuredArray1 = structuredArray1.map((item, index) => {
                    const lineContent = currentContent[index]?.trim();

                    // 检查行内容是否与human_json文件的内容匹配
                    const existsInHumanJson = humanJsonArray.some(humanItem => humanItem.content.trim() === lineContent);

                    if (!existsInHumanJson && lineContent !== item.content.trim()) {
                        return { type: item.type, content: lineContent || '' }; // 更新为变化行
                    }
                    return item; // 保持原样
                });

                // 保存更新后的JSON文件
                fs.writeFileSync(jsonFilePath1, JSON.stringify(structuredArray1, null, 2), 'utf-8');
            } catch (error) {
                //vscode.window.showErrorMessage(`Error writing to JSON file: ${error}`);
            }
        }
    });

    vscode.window.onDidChangeTextEditorSelection(onLineClick);

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        // 确保在插件激活时更新装饰
        loadHumanJson(editor); // 先加载 human.json 数据
        updateDecorations(editor); // 更新装饰
    }

    let activeEditor = vscode.window.activeTextEditor;
    let decorationsArray: vscode.DecorationOptions[] = [];
    let isJsonDisplayMode = false;

    // 从 _py_human.json 或 _py.json 读取样式
    async function loadJsonDecorations(jsonFileName: string) {
        return new Promise<vscode.DecorationOptions[]>((resolve, reject) => {
            if (fs.existsSync(jsonFileName)) {
                fs.readFile(jsonFileName, 'utf-8', (err, data) => {
                    if (err) {
                        //vscode.window.showErrorMessage('Failed to read JSON file');
                        return reject(err);
                    }
                    try {
                        const jsonData = JSON.parse(data);
                        const decorations: vscode.DecorationOptions[] = jsonData
                            .filter((item: { type: number, content: string }) => item.type === 1)
                            .map((item: { type: number, content: string }) => {
                                const lineNum = findLineByContent(item.content);
                                if (lineNum !== -1 && activeEditor) {
                                    const range = activeEditor.document.lineAt(lineNum).range;
                                    return { range: range, hoverMessage: `Highlighted content: ${item.content}` };
                                }
                                return null;
                            })
                            .filter(Boolean) as vscode.DecorationOptions[];

                        resolve(decorations);
                    } catch (parseError) {
                        //vscode.window.showErrorMessage('Failed to parse JSON file');
                        reject(parseError);
                    }
                });
            } else {
                resolve([]);
            }
        });
    }

    function applyDecorations(decorationsArray: vscode.DecorationOptions[] = []) {
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 215, 0, 0.3)',
            borderRadius: '3px'
        });

        if (activeEditor) {
            activeEditor.setDecorations(decorationType, decorationsArray);
        }
    }

    async function switchDisplayMode() {
        if (activeEditor && activeEditor.document.languageId === 'python') {
            const pyFileName = activeEditor.document.fileName;
            const humanJsonFileName = pyFileName.replace(/(?!\.pseudo$)\.[^.]+$/, '_py_human.json');

            clearCurrentDecorations();

            if (isJsonDisplayMode) {
                isJsonDisplayMode = false;
                remake(context);
                vscode.window.showInformationMessage('切换到展示模式：按段生成');

            } else {
                isJsonDisplayMode = true;
                //const newDecorations = await loadJsonDecorations(humanJsonFileName);
                //applyDecorations(newDecorations);
                vscode.window.showInformationMessage('切换到展示模式: 是否机器生成');
            }
        }
    }

    function clearCurrentDecorations() {
        decorationsArray = [];
        const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 215, 0, 0.3)',
            borderRadius: '3px'
        });

        if (activeEditor) {
            activeEditor.setDecorations(decorationType, decorationsArray);
        }
    }

    function findLineByContent(content: string): number {
        if (!activeEditor) return -1;

        const document = activeEditor.document;
        for (let i = 0; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            if (lineText.includes(content)) {
                return i;
            }
        }
        return -1;
    }

    vscode.commands.registerCommand('CodeToolBox.switchDisplay', switchDisplayMode);
};
