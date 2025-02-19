import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function watchTxt() {
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        console.log("watchTxt");
        if (editor && editor.document === event.document && editor.document.fileName.endsWith('.pseudo')) {

            // 检查行变化并更新 JSON
            const jsonFileName = editor.document.fileName.replace(/\.pseudo$/, '_pseudo.json');
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';  // 获取工作区路径
            const jsonFilePath = path.join(workspaceFolder, jsonFileName);

            let structuredArray: { type: number, content: string }[] = [];
            try {
                if (fs.existsSync(jsonFilePath)) {
                    const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
                    structuredArray = JSON.parse(jsonData);
                }

                const currentContent = editor.document.getText().split('\n');

                // 更新 JSON 中的内容
                structuredArray = structuredArray.map((item, index) => {
                    if (currentContent[index]?.trim() !== item.content.trim()) {
                        return { type: item.type, content: currentContent[index]?.trim() || '' }; // 更新为变化行
                    }
                    return item; // 保持原样
                });

                // 保存更新后的 JSON 文件
                fs.writeFileSync(jsonFilePath, JSON.stringify(structuredArray, null, 2), 'utf-8');
            } catch (error) {
                //vscode.window.showErrorMessage(`Error writing to JSON file: ${error}`);
            }
        }
    });
}