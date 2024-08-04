import * as vscode from 'vscode';
import {createwebview} from "./createview/create";
import {registerCreateSetting} from "./setting/setting"
import {ask} from "./openai/keycheck"





export async function activate(context: vscode.ExtensionContext) {
    registerCreateSetting(context);
    createwebview(context);
    ask(context)


    // Workspace settings override User settings when getting the setting.
	// 当获取设置时，工作区设置会覆盖用户设置。

	// 如果未设置 API 密钥或 API 密钥验证不通过，则提示用户输入 API 密钥。
	// if (vscode.workspace.getConfiguration('scribeai').get('ApiKey') === "" 
	// || !(await validateAPIKey())) {
	// const apiKey = await showInputBox();
	// }

	// // 如果 OpenAI 实例未定义，则使用工作区设置中的 API 密钥创建 OpenAI 实例。
	// if (openai === undefined) {
	// openai = new OpenAIApi(new Configuration({
	// 	apiKey: vscode.workspace.getConfiguration('scribeai').get('ApiKey'),
	// }));
    // }
	// // 注册命令，用于向 Scribe AI 提出问题。
	// context.subscriptions.push(vscode.commands.registerCommand('mywiki.askAI', (reply: vscode.CommentReply) => {
    //     // 显示进度条，提示正在生成 AI 响应。
    //     vscode.window.withProgress({
    //         location: vscode.ProgressLocation.Notification,
    //         title: "Generating AI response...",
    //         cancellable: true
    //     }, async () => {
    //         await askAI(reply);		
    //     });
    // }));

   
      // And schedule updates to the content every second
      // const interval = setInterval(updateWebview, 1000);
      // panel.onDidDispose(
      //   () => {
      //     // When the panel is closed, cancel any future updates to the webview content
      //     clearInterval(interval);
      //   },
      //   null,
      //   context.subscriptions
      // );
}