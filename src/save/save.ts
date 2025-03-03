import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export const save = (context: vscode.ExtensionContext) => {
// 监听文档保存事件
vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
    if (document.fileName.endsWith('display.pseudocode')) {
        // 获取当前文件的内容
        const content = document.getText();
        const lines = content.split('\n'); // 将内容按行分割

        // 获取配置中的路径
        const configPath = vscode.workspace.getConfiguration('ai').get('path') as string;

        // 遍历每一行，查找相对路径并保存内容
        let currentRelativePath = '';
        let currentFileContent = '';
        const fileWriteCount: { [key: string]: number } = {}; // 用于记录每个文件的写入次数

        for (const line of lines) {
            // 检查是否是路径注释
            const pathMatch = line.match(/\/\/ --- 来源: (.+) ---/);
            if (pathMatch) {
                // 如果当前有内容，先写入上一个文件
                if (currentRelativePath && currentFileContent) {
                    const originalPath = path.join(configPath, currentRelativePath);
                    // 检查文件是否存在并决定写入模式
                    const writeMode = fileWriteCount[originalPath] ? 'a' : 'w'; // 'a' 为追加，'w' 为覆盖
                    fs.writeFileSync(originalPath, currentFileContent.trim(), { flag: writeMode });

                    // 更新写入次数
                    fileWriteCount[originalPath] = (fileWriteCount[originalPath] || 0) + 1;
                }

                // 更新当前相对路径
                currentRelativePath = pathMatch[1];
                currentFileContent = ''; // 重置当前文件内容
            } else {
                // 累加当前文件的内容
                currentFileContent += line + '\n';
            }
        }

        // 处理最后一个文件内容
        if (currentRelativePath && currentFileContent) {
            const originalPath = path.join(configPath, currentRelativePath);
            // 检查文件是否存在并决定写入模式
            const writeMode = fileWriteCount[originalPath] ? 'a' : 'w'; // 'a' 为追加，'w' 为覆盖
            fs.writeFileSync(originalPath, currentFileContent.trim(), { flag: writeMode });

            // 更新写入次数
            fileWriteCount[originalPath] = (fileWriteCount[originalPath] || 0) + 1;
        }
    }
});
}