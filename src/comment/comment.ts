import { commands, ExtensionContext } from "vscode";
import * as vscode from 'vscode';
import { askAI } from "../openai/keycheck";

let commentId = 1;

class NoteComment implements vscode.Comment {
	id: number;
	label: string | undefined;
	savedBody: string | vscode.MarkdownString; // for the Cancel button
	constructor(
		public body: string | vscode.MarkdownString,
		public mode: vscode.CommentMode,
		public author: vscode.CommentAuthorInformation,
		public parent?: vscode.CommentThread,
		public contextValue?: string
	) {
		this.id = ++commentId;
		this.savedBody = this.body;
	}
}
export const comment = (context: ExtensionContext) => {
    // A `CommentController` is able to provide comments for documents.
	const commentController = vscode.comments.createCommentController('comment-scribeai', 'ScribeAI Comment Controller');
	context.subscriptions.push(commentController);

	// A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
			const lineCount = document.lineCount;
			return [new vscode.Range(0, 0, lineCount - 1, 0)];
		}
	};

	commentController.options = {
		prompt: "Ask AI...",
		placeHolder: "Ask me anything! Example: \"Explain the above code in plain English\""
	};
	 // 注册生成按钮（generate）
	 let generateNoteCommand = vscode.commands.registerCommand('CodeToolBox.generateNote', (reply: vscode.CommentReply) => {
        vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating AI response...",
			cancellable: true
		}, async () => {
			await askAI1(reply);		
		});
    });

    // 注册查看按钮（look）
    let lookNoteCommand = vscode.commands.registerCommand('CodeToolBox.lookNote', () => {
        vscode.window.showInformationMessage('Look Button Clicked!');
    });

    // 注册可操作按钮（can）
    let canNoteCommand = vscode.commands.registerCommand('CodeToolBox.canNote', () => {
        vscode.window.showInformationMessage('Can Button Clicked!');
    });

    // 将这些命令添加到插件的订阅中
    context.subscriptions.push(generateNoteCommand, lookNoteCommand, canNoteCommand);
};
async function askAI1(reply: vscode.CommentReply) {
	const question = reply.text.trim();//用户提出的问题
	const thread = reply.thread;
	const model = vscode.workspace.getConfiguration('scribeai').get('models') + "";

	const humanComment = new NoteComment(new vscode.MarkdownString(question), vscode.CommentMode.Preview, { name: 'VS Code', iconPath: vscode.Uri.parse("https://img.icons8.com/fluency/96/null/user-male-circle.png") }, thread, thread.comments.length ? 'canDelete' : undefined);
	thread.comments = [...thread.comments, humanComment];
	
	// If openai is not initialized initialize it with existing API Key 
	// or if doesn't exist then ask user to input API Key.
	const ths =   await getCommentThreadCode(thread);
	const codeblock = ths["code"]//选中的codeblock
	const filePath = ths["filePath"]//选中的codeblock所在文件的绝对路径 例如：d:\new\123\display.pseudocode
	//更改文件资源管理系统
	const gen = vscode.workspace.getConfiguration('ai').get('path') + ""
	//todo//调用openai接口完成信息回传
	const responseText = await askAI(codeblock + "First, you need to determine whether this is actual code or pseudocode. If it's code, keep the current language and only modify the content. If it's pseudocode, maintain the current pseudocode format and only modify the content. My suggested changes are:" +question, filePath.slice(gen.length + 1));
	const AIComment = new NoteComment(new vscode.MarkdownString(responseText.trim()), vscode.CommentMode.Preview, { name: 'AI', iconPath: vscode.Uri.parse("https://img.icons8.com/fluency/96/null/chatbot.png") }, thread, thread.comments.length ? 'canDelete' : undefined);
	thread.comments = [...thread.comments, AIComment];

}
async function getCommentThreadCode(thread: vscode.CommentThread) {
	const document = await vscode.workspace.openTextDocument(thread.uri);
	// 获取选中代码的文本
	const code = document.getText(thread.range).trim();
	// 获取当前文件的绝对路径
	const filePath = document.uri.fsPath;
	// Get selected code for the comment thread
	return { code, filePath };
}
