import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let lineStates: boolean[] = [];

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

        if (lineStates.length !== lineCount) {
            lineStates = new Array(lineCount).fill(true);
        }

        for (let i = 0; i < lineCount; i++) {
            const lineText = editor.document.lineAt(i).text;

            if (lineText.trim() === '') {
                continue;
            }

            if (lineText.trim().startsWith('// ---')) {
                const isCollapsed = !lineStates[i];
                const decorationType = isCollapsed ? closeButtonDecorationType : openButtonDecorationType;
                const range = new vscode.Range(i, 0, i, 0);
                if (isCollapsed) {
                    closeButtonRanges.push(range);
                } else {
                    openButtonRanges.push(range);
                }
            }
        }

        editor.setDecorations(openButtonDecorationType, []);
        editor.setDecorations(closeButtonDecorationType, []);
        editor.setDecorations(openButtonDecorationType, openButtonRanges);
        editor.setDecorations(closeButtonDecorationType, closeButtonRanges);
    };

    const toggleDecorationCommand = vscode.commands.registerCommand('CodeToolBox.toggleFileDecoration', async (lineNumber: number, editor: vscode.TextEditor) => {
        const lineText = editor.document.lineAt(lineNumber).text;
        if (!lineText.trim().startsWith('// ---')) {
            console.log('Clicked non-comment line, no action taken.');
            return;
        }

        lineStates[lineNumber] = !lineStates[lineNumber];

        const startLine = lineNumber + 1;
        let endLine = startLine;

        while (endLine < editor.document.lineCount) {
            const nextLineText = editor.document.lineAt(endLine).text;
            if (nextLineText.trim().startsWith('// ---')) {
                break;
            }
            endLine++;
        }

        const isCollapsed = lineStates[lineNumber] === false;

        if (isCollapsed) {
            // 清空折叠内容
            await editor.edit(editBuilder => {
                for (let i = startLine; i < endLine; i++) {
                    editBuilder.replace(new vscode.Range(i, 0, i, editor.document.lineAt(i).text.length), '');
                }
            });
        } else {
            // 读取文件内容并恢复折叠的内容
            const filePath = editor.document.fileName;
            const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');

            await editor.edit(editBuilder => {
                for (let i = startLine; i < endLine; i++) {
                    if (fileContent[i]) {
                        editBuilder.insert(new vscode.Position(i, 0), fileContent[i]);
                    }
                }
            });
        }

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
            const lineText = editor.document.lineAt(line).text;
            
            // 检查当前是否有多个选择（用户长按拖动）
            if (event.selections.length === 1 && event.selections[0].start.isEqual(event.selections[0].end)) {
                // 只有当选择是单行点击时才触发折叠
                if (lineText.trim().startsWith('// ---')) {
                    console.log(`Line clicked: ${line}`);
                    vscode.commands.executeCommand('CodeToolBox.toggleFileDecoration', line, editor);
                }
            }
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