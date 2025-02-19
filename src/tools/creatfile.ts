import * as vscode from 'vscode';

export  async function creatfile(context: vscode.ExtensionContext,con:string,lan:string) {
    const content = con;
    const language = lan; // 可以根据需要设置语言，例如 'typescript', 'javascript', 'markdown' 等
    console.log(con)
    console.log(lan)
    // 创建 TextDocument 实例，这是一个内存中的临时文档
    const document = await vscode.workspace.openTextDocument({
        content: content,
        language: language
    });

    // 显示文档
    const editor = await vscode.window.showTextDocument(document);

    // 注册文档关闭时的处理逻辑
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(async closedDoc => {
        if (closedDoc === document) {
            const optionSave = 'Save';
            const optionDiscard = 'Discard';
            // 关闭文档
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    }));

}
