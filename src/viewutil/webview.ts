// import * as vscode from "vscode";
// import * as fs from 'fs';

// // 获取 webview html
// export const getHtmlForWebview = (webview: vscode.WebviewView,context: vscode.ExtensionContext) => {

//     const path = require('path');
//         const resourcePath = path.join(__dirname, './pro.html');
//         const dirPath = path.dirname(resourcePath);
//         let htmlIndexPath = fs.readFileSync(resourcePath, 'utf-8');
    
//         const html = htmlIndexPath.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
//             const absLocalPath = path.resolve(dirPath, $2);
//             const webviewUri = webview.webview.asWebviewUri(vscode.Uri.file(absLocalPath));
//             const replaceHref = $1 + webviewUri.toString() + '"';
//             return replaceHref;
//         });
//         return html;
// };
import * as vscode from "vscode";
import * as fs from 'fs';

// 获取 webview html
export const getHtmlForWebview = (webview: vscode.WebviewView,context: vscode.ExtensionContext) => {

    const path = require('path');
    // 定义要读取的 HTML 文件路径
    const htmlFilePath = path.join(__dirname, './pro.html'); 
    try {
        // 同步读取文件内容
        const htmlString = fs.readFileSync(htmlFilePath, 'utf8');
        console.log(htmlString);
        // 在这里可以直接处理 htmlString，例如返回它或者进行其他操作
        return htmlString;
    } catch (err) {
        console.error(`Error reading file: ${err}`);
        return ""; // 可以返回默认值或者其他错误处理逻辑
    }
};
