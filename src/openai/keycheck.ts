import * as vscode from 'vscode';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";

let openai: OpenAIApi | undefined = undefined;

  /**
 * 显示输入框以获取 API 密钥，使用 window.showInputBox() 方法。
 * 检查输入的 API 密钥是否有效。
 * 更新用户设置中的 API 密钥为新输入的 API 密钥。
 */
export async function showInputBox() {
  const result = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'Your OpenAI API Key', // 输入框占位符
      title: 'Scribe AI', // 输入框标题
      prompt: '您尚未设置 OpenAI API 密钥，或者您输入的 API 密钥不正确，请输入正确的 API 密钥以使用 ScribeAI 扩展。', // 提示信息
      validateInput: async text => {
          vscode.window.showInformationMessage(`正在验证: ${text}`);
          if (text === '') {
              return 'API 密钥不能为空';
          }
          try {
              openai = new OpenAIApi(new Configuration({
                  apiKey: text,
              }));
              await openai.listModels(); // 尝试列出模型来验证 API 密钥
          } catch(err) {
              return '您的 API 密钥无效';
          }
          return null; // 返回 null 表示验证通过
      }
  });
  vscode.window.showInformationMessage(`获取到的 API 密钥: ${result}`);
  // 将 API 密钥写入用户设置
  await vscode.workspace.getConfiguration('scribeai').update('ApiKey', result, true);
  // 将 API 密钥写入工作区设置
  // await vscode.workspace.getConfiguration('scribeai').update('ApiKey', result, false);
  return result; // 返回获取到的 API 密钥
}
/**
 * 验证 API 密钥的有效性。
 * 如果验证通过，将创建一个 OpenAIApi 实例并赋给 openai 变量。
 * 如果验证失败，返回 false。
 */
async function validateAPIKey() {
    try {
        openai = new OpenAIApi(new Configuration({
            apiKey: vscode.workspace.getConfiguration('scribeai').get('ApiKey'),
        }));
        await openai.listModels(); // 尝试列出模型来验证 API 密钥
    } catch(err) {
        return false; // 验证失败
    }
    return true; // 验证通过
}
export async function ask(context: vscode.ExtensionContext){
    // Workspace settings override User settings when getting the setting.
	// 当获取设置时，工作区设置会覆盖用户设置。

	// 如果未设置 API 密钥或 API 密钥验证不通过，则提示用户输入 API 密钥。
	if (vscode.workspace.getConfiguration('scribeai').get('ApiKey') === "" 
	|| !(await validateAPIKey())) {
	const apiKey = await showInputBox();
	}

	// 如果 OpenAI 实例未定义，则使用工作区设置中的 API 密钥创建 OpenAI 实例。
	if (openai === undefined) {
	openai = new OpenAIApi(new Configuration({
		apiKey: vscode.workspace.getConfiguration('scribeai').get('ApiKey'),
	}));
	}
    // // 注册命令，用于向 Scribe AI 提出问题。
	// context.subscriptions.push(vscode.commands.registerCommand('askAI',async (message) => {
    //     await askAI(message);		
    // }));
}
export async function askAI(message:string) {
    // const question = reply.text.trim(); // 获取用户提出的问题
    // const thread = reply.thread; // 获取线程对象
    const model = vscode.workspace.getConfiguration('scribeai').get('models') + ""; // 获取配置中的模型类型

    let prompt = ""; // 初始化用于生成AI响应的提示文本
    let chatGPTPrompt: ChatCompletionRequestMessage[] = []; // 用于ChatGPT模型的提示消息数组

    // 根据配置的模型类型选择不同的生成提示文本的方法
    if (model === "ChatGPT" || model === "gpt-4") {
        chatGPTPrompt = await generatePromptChatGPT(message); // 生成适用于ChatGPT的提示消息
    } else {
        prompt = await generatePromptV1(message); // 生成适用于其他模型的提示文本
    }

    // 如果openai未初始化，则使用现有的API密钥初始化它，或者如果不存在，则提示用户输入API密钥
    if (openai === undefined) {
        if (vscode.workspace.getConfiguration('scribeai').get('ApiKey') === '') {
            const apiKey = await showInputBox(); // 获取用户输入的API密钥
        }

        // 使用配置中的API密钥初始化openai实例
        openai = new OpenAIApi(new Configuration({
            apiKey: vscode.workspace.getConfiguration('scribeai').get('ApiKey'),
        }));
    }
    let res = "";
    // 根据选择的模型类型调用不同的OpenAI API生成响应
    if (model === "ChatGPT" || model === "gpt-4") {
        const response = await openai.createChatCompletion({
            model: (model === "ChatGPT" ? "gpt-3.5-turbo" : "gpt-4"), // 选择适当的ChatGPT模型版本
            messages: chatGPTPrompt,
            temperature: 0, // 控制生成文本的多样性，0表示尽可能精确
            max_tokens: 1000, // 生成文本的最大长度
            top_p: 1.0, // 采样的概率分布阈值
            frequency_penalty: 1, // 控制生成文本中重复词语的频率
            presence_penalty: 1, // 控制生成文本中主题相关词语的频率
        });

        // 从响应中获取生成的文本内容或显示错误信息
        const responseText = response.data.choices[0].message?.content ? response.data.choices[0].message?.content : 'An error occured. Please try again...';
        res = responseText.trim()
    } else {
        const response = await openai.createCompletion({
            model: model,
            prompt: prompt,
            temperature: 0,
            max_tokens: 500,
            top_p: 1.0,
            frequency_penalty: 1,
            presence_penalty: 1,
            stop: ["Human:"], // 设置V1 API的停止词
        });
        console.log(response)
        // 从响应中获取生成的文本内容或显示错误信息
        const responseText = response.data.choices[0].text ? response.data.choices[0].text : 'An error occured. Please try again...';
        res  = responseText.trim()
    }
    return res;
    }
    /**
	 * Generates the prompt to pass to OpenAI ChatGPT API.
	 * Prompt includes: 
	 * - Role play text that gives context to AI
	 * - Code block highlighted for the comment thread
	 * - All of past conversation history + example conversation
	 * - User's new question
	 * @param question
	 * @param thread 
	 * @returns 
	 */
	async function generatePromptChatGPT(question: string) {
		const messages: ChatCompletionRequestMessage[] = [];
		messages.push({"role" : "user", "content" : `${question}`});

		return messages; 
	}
    /**
         * Generates the prompt to pass to OpenAI.
         * Prompt includes: 
         * - Role play text that gives context to AI
         * - Code block highlighted for the comment thread
         * - All of past conversation history + example conversation
         * - User's new question
         * @param question
         * @param thread 
         * @returns 
         */
    async function generatePromptV1(question: string) {
        const rolePlay =
            "I want you to act as a highly intelligent AI chatbot that has deep understanding of any coding language and its API documentations. I will provide you with a code block and your role is to provide a comprehensive answer to any questions or requests that I will ask about the code block. Please answer in as much detail as possible and not be limited to brevity. It is very important that you provide verbose answers and answer in markdown format.";

        
        let conversation = "Human: Who are you?\n\nAI: I am a intelligent AI chatbot\n\n";

        conversation += `Human: ${question}\n\nAI: `;

        return rolePlay + "\n```\n\n\n" + conversation; 
    }
    /**
	 * Gets the highlighted code for this comment thread
	 * @param thread
	 * @returns 
	 */
	async function getCommentThreadCode(thread: vscode.CommentThread) {
		const document = await vscode.workspace.openTextDocument(thread.uri);
		// Get selected code for the comment thread
		return document.getText(thread.range).trim();
	}
