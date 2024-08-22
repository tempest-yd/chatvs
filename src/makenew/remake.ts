import * as vscode from 'vscode';

export const remake = (context: vscode.ExtensionContext) => {
    let activeEditor = vscode.window.activeTextEditor;
    let decorationsArray: vscode.DecorationOptions[] = [];

    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(128, 128, 128, 0.3)', // 金色背景，半透明
        borderRadius: '3px'
    });

    if (activeEditor) {
        initializeDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            initializeDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            updateDecorations(event.contentChanges);
        }
    }, null, context.subscriptions);

    function updateDecorations(changes: readonly vscode.TextDocumentContentChangeEvent[]) {
        if (activeEditor) {
            changes.forEach(change => {
                if (activeEditor) {
                    const startPos = activeEditor.document.positionAt(change.rangeOffset);
                    const endPos = activeEditor.document.positionAt(change.rangeOffset + change.rangeLength + change.text.length);
                    const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: "Newly edited content" };
                    decorationsArray.push(decoration);
                }
            });

            activeEditor.setDecorations(decorationType, decorationsArray);
        }
    }

    function initializeDecorations() {
        decorationsArray = [];
        if (activeEditor) {
            activeEditor.setDecorations(decorationType, decorationsArray);
        }
    }
};