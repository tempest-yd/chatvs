import * as vscode from 'vscode';
import * as path from 'path';

let lineStates: boolean[] = []; // 用于存储每一行的状态

// 全局变量，用于存储折叠内容的二维数组
let foldedContents: string[][] = [];

export const collapse = (context: vscode.ExtensionContext) => {
    const openButtonDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: ' ▼',
            color: '#008000',
            margin: '0 10px 0 0',
            textDecoration: 'none',
        }
    });

    const closeButtonDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: ' ►',
            color: '#0000FF',
            textDecoration: 'none',
            margin: '0 10px 0 0',
        }
    });

    const updateDecorationType = (editor: vscode.TextEditor) => {
        const lineCount = editor.document.lineCount;
        const openButtonRanges: vscode.Range[] = [];
        const closeButtonRanges: vscode.Range[] = [];
    
        // 初始化或更新行状态数组
        if (lineStates.length !== lineCount) {
            lineStates = new Array(lineCount).fill(true); // 默认所有行为展开状态
        }
    
        for (let i = 0; i < lineCount; i++) {
            const lineText = editor.document.lineAt(i).text;
    
            if (lineText.trim() === '') {
                continue; // 跳过空行
            }
    
            if (lineText.trim().startsWith('// ---')) {
                const isCollapsed = !lineStates[i]; // 使用数组中的状态
                const decorationType = isCollapsed ? closeButtonDecorationType : openButtonDecorationType; // 根据状态选择装饰
    
                const range = new vscode.Range(i, 0, i, 0);
                if (isCollapsed) {
                    closeButtonRanges.push(range); // 添加到收起装饰范围
                } else {
                    openButtonRanges.push(range); // 添加到展开装饰范围
                }
            }
        }
    
        // 先清空所有装饰
        editor.setDecorations(openButtonDecorationType, []);
        editor.setDecorations(closeButtonDecorationType, []);
    
        // 设置新的装饰
        editor.setDecorations(openButtonDecorationType, openButtonRanges);
        editor.setDecorations(closeButtonDecorationType, closeButtonRanges);
    };
    
    // 在 toggleDecorationCommand 中的状态切换保持不变
    const toggleDecorationCommand = vscode.commands.registerCommand('CodeToolBox.toggleFileDecoration', async (lineNumber: number, editor: vscode.TextEditor) => {
        const lineText = editor.document.lineAt(lineNumber).text;
        if (!lineText.trim().startsWith('// ---')) {
            console.log('Clicked non-comment line, no action taken.');
            return; // 如果不是注释行，返回
        }
    
        // 切换当前行的折叠状态
        lineStates[lineNumber] = !lineStates[lineNumber]; // 切换状态
    
        // 确定折叠或展开的范围
        const startLine = lineNumber + 1; // 从当前行开始
        let endLine = startLine;
    
        while (endLine < editor.document.lineCount) {
            const nextLineText = editor.document.lineAt(endLine).text;
            if (nextLineText.trim().startsWith('// ---')) {
                break; // 遇到下一个注释行，停止
            }
            endLine++; // 继续向下查找
        }
    
        const isCollapsed = lineStates[lineNumber] === false; // 如果当前状态为收起，则折叠
    
        if (isCollapsed) {
            // 确保二维数组有足够的空间
            if (!foldedContents[lineNumber]) {
                foldedContents[lineNumber] = []; // 为当前行初始化一个空数组
            }
    
            // 保存折叠的内容
            await editor.edit(editBuilder => {
                for (let i = startLine; i < endLine; i++) {
                    foldedContents[lineNumber].push(editor.document.lineAt(i).text); // 存储当前行的内容
                    editBuilder.replace(new vscode.Range(i, 0, i, editor.document.lineAt(i).text.length), ''); // 清空行内容
                }
            });
        } else {
            // 恢复折叠的内容
            await editor.edit(editBuilder => {
                if (foldedContents[lineNumber]) {
                    for (let i = startLine; i < endLine; i++) {
                        if (foldedContents[lineNumber][i - startLine]) { // 确保内容存在
                            editBuilder.insert(new vscode.Position(i, 0), foldedContents[lineNumber][i - startLine]); // 恢复内容
                        }
                    }
                }
            });
        }
    
        // 更新当前行的装饰
        updateDecorationType(editor);
    });

    context.subscriptions.push(toggleDecorationCommand);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            const fileExtension = path.extname(editor.document.fileName);
            if (fileExtension === '.pseudocode') {
                updateDecorationType(editor);
            }
        }
    });

    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        const line = editor.selection.active.line;
        const fileExtension = path.extname(editor.document.fileName);
        
        if (fileExtension === '.pseudocode') {
            console.log(`Line clicked: ${line}`);
            vscode.commands.executeCommand('CodeToolBox.toggleFileDecoration', line, editor);
        }
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
            const fileExtension = path.extname(editor.document.fileName);
            if (fileExtension === '.pseudocode') {
                updateDecorationType(editor);
            }
        }
    });
};