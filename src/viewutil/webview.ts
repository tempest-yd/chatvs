// import * as vscode from "vscode";
// import * as fs from 'fs';

// // 获取 webview html
// export const getHtmlForWebview = (webview: vscode.WebviewView,context: vscode.ExtensionContext) => {


// };
import * as vscode from "vscode";
import * as fs from 'fs';

// 获取 webview html
export const getHtmlForWebview = (webview: vscode.WebviewView,context: vscode.ExtensionContext) => {
    const path = require('path');
    var html1 = `
   <!DOCTYPE html>
<html lang="en">
<head>
    <script src="${webview.webview.asWebviewUri(
        vscode.Uri.file(context.asAbsolutePath('html/prism.js'))
      )}"></script>
    <link href="${webview.webview.asWebviewUri(
        vscode.Uri.file(context.asAbsolutePath('html/prism.css'))
      )}" rel="stylesheet" />`

    const htmlFilePath = path.join(__dirname, '../../html/pro.html'); 
    try {
        // 同步读取文件内容
        const htmlString = fs.readFileSync(htmlFilePath, 'utf8');

        // 在这里可以直接处理 htmlString，例如返回它或者进行其他操作
        return  html1 + htmlString ;
    } catch (err) {
        console.error(`Error reading file: ${err}`);
        return ""; // 可以返回默认值或者其他错误处理逻辑
    }
};
