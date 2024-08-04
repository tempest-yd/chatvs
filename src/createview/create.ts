import * as vscode from 'vscode';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import {getHtmlForWebview} from "../viewutil/webview";
import {askAI} from "../openai/keycheck"
import { text } from 'stream/consumers';
import {extractCodeAndText} from '../tools/re'
import * as path from 'path';
import {creatfile} from "../tools/creatfile"
  // 创建一个 webview 视图
  let webviewViewProvider: MyWebviewViewProvider | undefined;
  // 获取扩展的根路径

// 实现 Webview 视图提供者接口，以下内容都是 chatGPT 提供
class MyWebviewViewProvider implements vscode.WebviewViewProvider {
  public webview?: vscode.WebviewView["webview"];

  constructor(private context: vscode.ExtensionContext) {
    this.context = context;
  }
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webview = webviewView.webview;
    // 设置 enableScripts 选项为 true
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'out'))] 
    };
    // 设置 Webview 的内容
    webviewView.webview.html = getHtmlForWebview(webviewView,this.context);
    console.log(webviewView.webview.html)
    
    //收消息
    webviewView.webview.onDidReceiveMessage(
      
      message => {
        switch (message.command) {
          case 'chat':
            (async () => {
              const res = await askAI(message.text + message.need);
              console.log(res)
              //传回     回消息。
              // Send a message to our webview.
              // You can send any JSON serializable data.
              // vscode.window.showErrorMessage(res)
              const seg: { type: string, content: string ,lan:string}[] = extractCodeAndText(res);
              webviewView.webview.postMessage({ command: 'rechat' ,segments:seg});
              // 继续执行其他逻辑
            })();	
            return;
          case 'makefile':
            (async () => {
              creatfile(this.context,message.con,message.lan)
              // 继续执行其他逻辑
            })();	

            vscode.window.showErrorMessage(message.text);
            return;
          case 'check':
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  // 销毁
  removeWebView() {
    this.webview = undefined;
  }
}
const openChatGPTView = (selectedText?: string) => {
    // 唤醒 chatGPT 视图 连接openai此处写后端
    vscode.commands.executeCommand("workbench.view.extension.CodeToolBox").then(() => {
      vscode.commands
        .executeCommand("setContext", "CodeToolBox.chatGPTView", true)
        .then(() => {
            //验证获取设置中的内容，在package。json中的configuration中设置
            const config = vscode.workspace.getConfiguration("CodeToolBox");
            const hostname = config.get("hostname");
            const apiKey = config.get("apiKey");
            const model = config.get("model");
            setTimeout(() => {
            // 发送任务,并传递参数
            if (!webviewViewProvider || !webviewViewProvider?.webview) {
              return;
            }
            webviewViewProvider.webview.postMessage({
                cmd: "vscodePushTask",
                task: "route",
                data: {
                  path: "/chat-gpt-view",
                  query: {
                    hostname,
                    apiKey,
                    selectedText,
                    model,
                  },
                },
            });
          }, 500);
        });
    });
};
export async function createwebview(context: vscode.ExtensionContext) {
     // 注册 webview 视图
     //此方法链接json中的views，type为webview类型
    webviewViewProvider = new MyWebviewViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
        "CodeToolBox.chatGPTView",
        webviewViewProvider,
        {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        },
    ),
    );

    context.subscriptions.push(
        // 添加打开视图
        vscode.commands.registerCommand("CodeToolBox.openChatGPTView", () => {
          openChatGPTView();
        }),

        // 添加关闭视图
        vscode.commands.registerCommand("CodeToolBox.hideChatGPTView", () => {
            vscode.commands
            .executeCommand("setContext", "CodeToolBox.chatGPTView", false)
            .then(() => {
            webviewViewProvider?.removeWebView();
            });
        }),
    )


}