import * as vscode from 'vscode';

import { getHtmlForWebview } from "../viewutil/webview";
import { askAI } from "../openai/keycheck"
import { text } from 'stream/consumers';
import { extractCodeAndText } from '../tools/re'
import { ex,ex1 } from '../tools/ex'
import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { projects } from '../extension';
import { creatfile } from "../tools/creatfile"
import * as JSON5 from 'json5';
import { decontext } from "../openai/keycheck"
// 创建一个 webview 视图
let webviewViewProvider: MyWebviewViewProvider | undefined;
let fileDecorations: { [key: string]: boolean } = {};
// 获取扩展的根路径
// 遍历模块数组
interface Module {
  module: string;
  functionality: string[];
  pseudoCode: string;
}

interface TempModule {
  id: string;
  content: string;
}
interface Project {
  id: string;
  name: string;
  segments: Project [];
}

//保存代码差别
interface Line {
  type: number;
  content: string;
}

interface CodeLine {
  type: number;
  content: string;
}

function removeExtension(filename: string, extension: string) {
  const regex = new RegExp(`${extension}$`);
  return filename.replace(regex, '');
}

async function readPseudoFilesRecursively(folderPath: string): Promise<string[]> {
  const files = await fs.promises.readdir(folderPath);
  let pseudoFiles: string[] = [];

  for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = await fs.promises.stat(filePath);

      if (stat.isDirectory()) {
          // 递归调用
          const nestedPseudoFiles = await readPseudoFilesRecursively(filePath);
          pseudoFiles = pseudoFiles.concat(nestedPseudoFiles);
      } else if (file.endsWith('.pseudo')) {
          pseudoFiles.push(filePath);
      }
  }

  return pseudoFiles;
}

function extractAlgorithm(text: string, path: string): string | null {
  const startPattern = `// --- 来源: ${path} ---`;
  const endPattern = '// ---';
  // 查找起始位置
  const startIndex = text.indexOf(startPattern);
  if (startIndex === -1) {
      return null; // 路径不存在
  }
  // 从起始位置偏移到伪代码的开头
  let contentStartIndex = startIndex + startPattern.length;
  // 查找结束位置
  const endIndex = text.indexOf(endPattern, contentStartIndex);
  // 如果找到结束位置，则截取内容
  let contentEndIndex = endIndex !== -1 ? endIndex : text.length;
  // 提取伪代码内容并去除多余空白
  const content = text.substring(contentStartIndex, contentEndIndex).trim();
  console.log("content   "+content)
  return content;
}


function findProjectById(projects: Project[], id: string): Project | null {
  console.log(projects);
  for (const project of projects) {
      if (project.id === id) {
          return project; 
      }
      console.log(project.id+"不是要找的");
      const foundInSegments = findProjectById(project.segments, id);
      if (foundInSegments) {
          return foundInSegments; 
      }
  }
  return null; // Not found
}

function extractByTypeFromFile(filePath: string, typeValue: number): string {
  try {
    // 读取文件并解析为 JSON
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: CodeLine[] = JSON.parse(fileContent);

    // 提取符合type条件的content，并且拼接为字符串
    return data
      .filter(item => item.type === typeValue && item.content.trim() !== "")
      .map(item => item.content)
      .join('');
  } catch (error) {
    console.error("Error reading or parsing file:", error);
    return '';
  }
}

function parseCodeToStructure(result: string, filename: string): CodeLine[] {
  const lines = result.split('\n'); // 按行分割
  const structuredArray: CodeLine[] = [];

  let currentType: number | null = null;

  for (let line of lines) {
    // 先去掉 undefined，再处理
    line = line.replace(/undefined/g, '').trim();
    if (line === '') {
      continue; // 跳过空行
    }
    const typeNumber = parseInt(line, 10);
    if (!isNaN(typeNumber)) {
      // 如果这一行是数字，表示这是一个 type 值
      currentType = typeNumber;
    } else if (currentType !== null) {
      const content = line.trim();
      // 只有在 content 非空的情况下才添加到结果中
      if (content !== '') {
        structuredArray.push({
          type: currentType,
          content: content
        });
      }
    }
  }

  // 将 structuredArray 中的 content 保存为特定文件，type 全为 0(大模型生成)
  const outputArray = structuredArray.map(item => ({
    type: 0,
    content: item.content
  }));

  // 保存文件
  filename = filename.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
  const outputPath = path.resolve(__dirname, filename);
  fs.writeFileSync(outputPath, JSON.stringify(outputArray, null, 2), 'utf-8');

  return structuredArray; // 返回原始的 structuredArray
}


// 初始化 JSON 文件函数
async function initializeJsonFile(jsonFilePath: string, documentText: string) {
  return new Promise((resolve, reject) => {
    const lines = documentText.split('\n');
    const jsonData = lines.map(line => ({
      type: 0, // 初始类型为 0，表示没有颜色
      content: line
    }));

    fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), { flag: 'wx' }, (err) => {
      if (err && err.code !== 'EEXIST') {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}
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
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'html'))]
    };
    // 设置 Webview 的内容
    webviewView.webview.html = getHtmlForWebview(webviewView, this.context);



    //收消息
    webviewView.webview.onDidReceiveMessage(
      message => {
        const firstLayerCode: string = `procedure addLetter(key):
    if current line has less than 5 letters inputed:
        add the corresponding letter into next tile

procedure deleteLetter():
    if current line has more than 0 letters inputed:
        remove the letter of the current tile
        
procedure changeColor(position, color):
	reset the element attribute of corresponding tile
        `;
        const alarmManagementCode: string = `
        do for all sensors
            invoke checkSensor procedure returning signalValue
            if signalValue > bound[alarmType] then
                phone.message = message[alarmType]
                set alarmBell to "on" for alarmTimeSeconds
                set system status = "alarmCondition"
                
                parbegin
                    invoke alarm procedure with "on", alarmTimeSeconds
                    invoke phone procedure set for alarmType, phoneNumber
                parend
            else
                skip
            endif
        end do for
        end alarmManagement
        `;
        switch (message.command) {
          case "addnode":
            (async () => {
              //更改数据结构
              let project = projects.find(project => project.id === message.fatherid);
              if (project) {
                project.segments.push({
                  id: message.fatherid + "/" + message.childlabel,
                  name: message.childlabel,
                  segments: []
                })
              }
              //更改文件资源管理系统
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              //文件路径
              const fileName: string =  "content.pseudo";
              const foderPath: string = path.join(model, message.fatherid, message.childlabel);
              const filePath: string =  path.join(model, message.fatherid, message.childlabel,fileName);
              // 创建并写入文件
              try {
                if (!fs.existsSync(foderPath)) {
                  fs.mkdirSync(foderPath, { recursive: true });
                }
                fs.writeFileSync(filePath, "这是新创建的node content");
              } catch (error) {
                console.error(`创建文件 "${fileName}" 时出错: ` + error);
              }
              webviewView.webview.postMessage({});
            })();

            return
          case "addpro":
            (async () => {
              //更改数据结构
                projects.push({
                  id:  message.childlabel,
                  name: message.childlabel,
                  segments: []
                })

              //更改文件资源管理系统
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              //文件路径
              const fileName: string = message.childlabel;
              const filePath: string = path.join(model,  fileName);
              //文件路径
              const file: string =  "content.pseudo";
              const filePa: string =  path.join(filePath, file);
              // 创建并写入文件
              try {
                if (!fs.existsSync(filePath)) {
                  fs.mkdirSync(filePath, { recursive: true });
                }
                fs.writeFileSync(filePa, "这是新创建的node content");
              } catch (error) {
                console.error(`创建文件 "${fileName}" 时出错: ` + error);
              }
              webviewView.webview.postMessage({});
            })();

            return
          case "deletenode":
            (async () => {
              //更改数据结构
              let project = projects.find(project => 
                project.segments.some(segment => segment.id === message.fatherid)
              );
              const index = project?.segments.findIndex(pro => pro.id === message.fatherid);
              
              if (index !== undefined && index !== -1 && project) {
                // 使用 splice 移除对象
                project.segments.splice(index, 1);
              }
              
              //更改文件资源管理系统
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              //文件路径
              const fileName: string = message.fatherid;
              const folderPath: string = path.join(model,  fileName);
              // 创建并写入文件
              try {
                // 检查文件夹是否存在
                const exists = await fs.pathExists(folderPath);
                if (!exists) {
                  console.log(`文件夹 ${folderPath} 不存在`);
                  return;
                }
            
                // 递归删除文件夹中的文件和子文件夹
                await fs.remove(folderPath);
                console.log(`文件夹 ${folderPath} 及其所有内容已删除`);
              } catch (err) {
                console.error('删除文件夹时出错:', err);
              }
              
            })();

            return
          case 'openfileandfolder':
              (async () => {
                console.log("openfileandfolder"+message.id)
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""

                    const folderPath: string = path.join(model, message.id)
                    const parentFolderPath = folderPath;
                    console.log(`选中的文件夹路径: ${parentFolderPath}`);
          
                    try {
                        const pseudoFiles = await readPseudoFilesRecursively(parentFolderPath);
                        console.log(`筛选出的 .pseudo 文件: ${pseudoFiles.join(', ')}`);
                        pseudoFiles.sort();
          
                        let content = '';
          
                        for (const filePath of pseudoFiles.filter(file => path.dirname(file) === parentFolderPath)) {
                            const fileContent = await fs.promises.readFile(filePath, 'utf-8');
                            const relativePath = path.relative(model, filePath);
                            content += `// --- 来源: ${relativePath} ---\n${fileContent}\n\n`;
                        }
          
                        for (const filePath of pseudoFiles.filter(file => path.dirname(file) !== parentFolderPath)) {
                            const isCollapsed = fileDecorations[filePath] === false;
                            if (!isCollapsed) {
                                const fileContent = await fs.promises.readFile(filePath, 'utf-8');
                                const relativePath = path.relative(model, filePath);
                                content += `// --- 来源: ${relativePath} ---\n${fileContent}\n\n`;
                            }
                        }
          
                        const outputFilePath = path.join(parentFolderPath, 'display.pseudocode');
                        await fs.promises.writeFile(outputFilePath, content);
                        console.log(`已创建输出文件: ${outputFilePath}`);
                        const structuredArray = content.split('\n').map(line => ({
                          type: 0,
                          content: line.trim() // 去掉行首尾的空格
                        }));
                        // 构造新文件名
                        console.log(structuredArray);
                        let filename1 = outputFilePath.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
                        console.log(filename1);
                        // 设置文件输出路径
                        const outputPath = path.resolve(__dirname, filename1);
                        console.log(outputPath);
                        // 将 structuredArray 写入 JSON 文件
                        fs.writeFileSync(outputPath, JSON.stringify(structuredArray, null, 2), 'utf-8');
                        console.log(`文件 "${outputPath}" 已创建并写入内容。`);
          
                        const doc = await vscode.workspace.openTextDocument(outputFilePath);
                        await vscode.window.showTextDocument(doc);
                        console.log(`已在 VSCode 中打开输出文件`);
                      } catch (error) {
                          //console.error(`错误: ${error.message}`);
                      }
                webviewView.webview.postMessage({});
              })();
              return;
          case 'generatepseudo':
            (async () => {
              const model = vscode.workspace.getConfiguration('ai').get('path') + "";
              let project = findProjectById(projects, message.id);
              console.log(message.id +":"+ project);
              const fileName = path.join(model, message.id,   'content.pseudo');
              let description = '';
              try {
                  description = fs.readFileSync(fileName, 'utf-8');
              } catch (error) {
                  console.error(`读取文件 "${fileName}" 时出错: ` + error);
              }
              const slashCount: number = (message.id.match(/\//g) || []).length;
              if (slashCount === 0) {
                  console.log("没有找到斜杠字符。");
              } else if (slashCount === 1) {
                  console.log("找到了一个斜杠字符。");
              } else if (slashCount === 2) {
                  console.log("找到了两个斜杠字符。");
              } else {
                  console.log(`找到了${slashCount}个斜杠字符。`);
              }
              let segments: TempModule[]=[];
              if (slashCount === 0) {
                const res = await askAI(message.con +"Below are my requirements." + description + "Below are your specific requirements: In your response, all colons should use English colons, and the response format should strictly follow each module's format as ###Module:Moudule name,&&&ability:Moudule ability. The response content should be in English. Here are the specific operations: First, you need to divide this project into modules, and the specific number of modules should be determined based on the difficulty of the requirements. The more difficult the project, the more modules should be divided. Regardless of how many modules you divide, they should form a complete project. The final result should be returned on a per-module basis, with each module containing the module name (no spaces allowed in the module name) and a description of the functionality (the description should be concise and no more than 10 words).", message.index);
                segments = extractCodeAndText(res);
              }
              if(slashCount === 1){
                const res = await askAI(message.con + "Below are my requirements." + description  + "Above is the description for one particular module. You need to generate pseudocode for this module according to the following requirements:" + message.con + "Below are your specific requirements: In your response, all colons should use English colons, and the content should be in English. The response format should strictly follow each part's format as ###Module:this part's name,&&&Pseudocode:Pseudocode content. Below are the specific requirements:You need to generate refined pseudocode for current pseudocode, and then divide it into several parts. The specific content of the refined pseudocode should be enclosed in ```." + `Learn from the following pseudocode example and then generate the corresponding pseudocode based on my requirements. Example:${alarmManagementCode}`, message.id);
                segments = extractCodeAndText(res);
              }
              if(slashCount === 2){
                const res = await askAI(message.con + "Below are my requirements." + description  + "Above is the pseudo for one particular module. You need to generate refined pseudocode for it according to the following requirements:" + message.con + "Below are your specific requirements: In your response, all colons should use English colons, and the content should be in English. The response format should strictly follow each part's format as ###Module:this part's name,&&&Pseudocode:Pseudocode content. Below are the specific requirements:You need to generate pseudocode for this module, and then divide it into several parts. The specific content of the pseudocode should be enclosed in ```." + `Learn from the following pseudocode example and then generate the corresponding pseudocode based on my requirements. Example:${firstLayerCode}`, message.index);
                segments = extractCodeAndText(res);
              }
              if (project) {
                  console.log("creating");
                  const basePath = path.join(model, message.id);
                  console.log(basePath);
                  console.log(segments);

                  for (const segment of segments) {
                      const moduleDir = path.join(basePath, segment.id);
                      fs.mkdirSync(moduleDir, { recursive: true });
                      const fileName = `content.pseudo`;
                      const filePath = path.join(moduleDir, fileName);
                      try {
                          fs.writeFileSync(filePath, segment.content);
                          console.log(`文件 "${fileName}" 已创建并写入内容。`);
          
                          const newSegmentProject = {
                            id: message.id + "/"  + segment.id, 
                            name: segment.id, 
                            segments: []
                          };
                          console.log(newSegmentProject);
                          webviewView.webview.postMessage({ command: 'update', segments:newSegmentProject, fatherid:message.id });
                          project.segments.push(newSegmentProject);
                      } catch (error) {
                          console.error(`创建文件 "${fileName}" 时出错: ` + error);
                      }
                  }

              }
              webviewView.webview.postMessage({});
            })();
          return;
          case 'regeneratepseudo':
            (async () => {
              const model = vscode.workspace.getConfiguration('ai').get('path') + "";
              const fileName = path.join(model, message.id, '/'+message.id) + '.pseudo';
              console.log(fileName);
              let currentpseudo = '';
              try {
                  currentpseudo = fs.readFileSync(fileName, 'utf-8');
              } catch (error) {
                  console.error(`读取文件 "${fileName}" 时出错: ` + error);
              }
              const res = await askAI(currentpseudo + "Above is the current. You need to regenerate this pseudocode the following requirements:" + message.con + "Below are your specific requirements: In your response, all colons should use English colons, and the content should be in English. Below are the specific requirements:You need to regenerate pseudocode for current pseudocode, and you need to make sure nothing appears in your response apart from the regenerated pseudocode." , message.index);
              const filteredRes = res.replace(/undefined/g, '').replace(/```/g, '').trim();
                      try {
                        fs.writeFileSync(fileName, filteredRes);
                        const doc = await vscode.workspace.openTextDocument(fileName);
                        await vscode.window.showTextDocument(doc);
                        console.log(`已在 VSCode 中打开文件`);
                      } catch (error) {
                          console.error(`重构 "${fileName}" 时出错: ` + error);
              }
              webviewView.webview.postMessage({});
          })();
          return;
          case 'open':
            (async () => {
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                  const folderPath: string = path.join(model, message.id,"content.pseudo");
                  try {
                      const outputFilePath = folderPath
                      console.log(outputFilePath)
                      const doc = await vscode.workspace.openTextDocument(outputFilePath);
                      await vscode.window.showTextDocument(doc);
                      console.log(`已在 VSCode 中打开文件`);
                    } catch (error) {
                        //console.error(`错误: ${error.message}`);
                    }
              webviewView.webview.postMessage({});
            })();
            return;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }
  disable() {
    if (this.webview) {
      this.webview.postMessage({ command: "dis" });
    }
  }
  able() {
    if (this.webview) {
      this.webview.postMessage({});
    }
  }
  addabilities(message: { project: string, model: string, con: string }) {
    if (this.webview) {
      this.webview.postMessage({ command: 'addabilities', project: message.project, model: message.model, con: message.con });
    }
  }
  // 销毁
  removeWebView() {
    this.webview = undefined;
  }

}

/**
 * 删除指定文件夹及其内容
 * @param dirPath 文件夹路径
 */
//根据语言类型决定文件扩展名
const getFileExtension = (language: string): string => {
  switch (language.toLowerCase()) {
    case 'java':
      return '.java';
    case 'python':
      return '.py';
    case 'javascript':
      return '.js';
    case 'typescript':
      return '.ts';
    case 'c':
      return '.c';
    case 'c++':
      return '.cpp';
    case 'html':
      return '.html';
    default:
      throw new Error('Unsupported language type');
  }
};
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
    vscode.commands.registerCommand('CodeToolBox.abilities', () => {
      (async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No active editor!');
          return;
        }
        const document = editor.document;
        const content = document.getText();

        //const result = "yes"
        const fileName = document.fileName;
        const fileType = fileName.substring(fileName.lastIndexOf('\\') + 1);
        const filename = fileType.substring(0, fileType.lastIndexOf('.'));
        let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename)));

        if (project) {
          let model = project?.segments.find(segment => segment.name.replace(/:/g, '-') === filename)
          const result: string = await askAI(content + "Based on the code or pseudocode above, list the functions they implement in sequence, with each function on a separate line. Summarize each function briefly. The final result should only contain the functions in separate lines without any additional information", project.id)
          if (model) {
            webviewViewProvider?.addabilities({ project: project?.id, model: model.id, con: result });
          }
        }
      })();

    }),
    // vscode.commands.registerCommand('CodeToolBox.pseudocode', () => {
    //   (async () => {
    //     webviewViewProvider?.disable()
    //     const editor = vscode.window.activeTextEditor;
    //     if (!editor) {
    //       vscode.window.showInformationMessage('No active editor!');
    //       webviewViewProvider?.able()
    //       return;
    //     }
    //     const document = editor.document;
    //     const content = document.getText();
    //     const fileName = document.fileName;
    //     const filename = fileName.substring(0, fileName.lastIndexOf('.')) + ".pseudo";

    //     const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
    //     const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
    //     let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
    //     let res = "";
    //     if (project) {
    //       res = await askAI(content + "Based on the code above, generate pseudocode for it, and make a class out of the pseudocode. The final result should contain only the pseudocode without any additional information. The pseudocode should be in natural language, without using programming language syntax!", project.id)
    //     }
    //     try {
    //       // 创建文件并写入内容
    //       fs.writeFileSync(filename, ex(res).content);
    //       console.log(`文件 "${fileName}" 已创建并写入内容。`);
    //       webviewViewProvider?.able()
    //     } catch (error) {
    //       console.error(`创建文件 "${fileName}" 时出错: ` + error);
    //       webviewViewProvider?.able()
    //     }
    //   })();
    // }),
    // vscode.commands.registerCommand('CodeToolBox.code', () => {
    //   (async () => {
    //     webviewViewProvider?.disable();
    //     const editor = vscode.window.activeTextEditor;
    //     if (!editor) {
    //       vscode.window.showInformationMessage('No editor is active');
    //       return;
    //     }
    //     const selection = editor.selection;
    //     if (selection.isEmpty) {
    //       vscode.window.showInformationMessage('No text selected');
    //       webviewViewProvider?.able();
    //       return;
    //     }
    //     const selectedText = editor.document.getText(selection); // 获取选中的文本
    //     const document = editor.document;
    //     const language = vscode.workspace.getConfiguration('ai').get('language') + "";
    //     const fileExtension: string = getFileExtension(language);
    //     const fileName = document.fileName;
    //     const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
    //     const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
    //     let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
    //     let result = "";
    //     let currentCode = "";
    //     let project_id = '';

    //     const instructionFilePath = fileName.substring(0, fileName.lastIndexOf('.')) + ".txt";
    //     let instructionContent = "";
    //     if (fs.existsSync(instructionFilePath)) {
    //       instructionContent = fs.readFileSync(instructionFilePath, 'utf8');
    //       console.log(`Read instruction from ${instructionFilePath}`);
    //     } else {
    //       console.log(`File ${instructionFilePath} does not exist.`);
    //     }
    //     // 文件路径
    //     const filename = fileName.substring(0, fileName.lastIndexOf('.')) + `${fileExtension}`;
    //     if (fs.existsSync(filename)) {
    //       currentCode = fs.readFileSync(filename, 'utf8');
    //       if (currentCode === "还未生成python代码") { currentCode = ""; }
    //       console.log(`File ${filename} exists. Reading currentCode from ${filename}，${currentCode}`)
    //     } else {
    //       console.log(`File ${filename} does not exist. Proceeding without current code "${filename}".`);
    //     }
    //     const codeTypeFile = fileName.substring(0, fileName.lastIndexOf('.')) + '_pseudo.json';
    //     let codeType = "";
    //     if (fs.existsSync(codeTypeFile)) {
    //       codeType = fs.readFileSync(codeTypeFile, 'utf8');
    //       console.log(`File ${codeTypeFile} exists. Reading currentCode from ${codeTypeFile}`);
    //     }
    //     console.log(currentCode.length);
    //     if (project && !(currentCode.length > 0)) {
    //       if (instructionContent) {
    //         currentCode = instructionContent + "\n" + currentCode;
    //       }
    //       project_id = project.id;
    //       decontext(project_id);
    //       result = await askAI(selectedText + `The above content is part of the pseudocode you previously generated for one module. Based on the overall project requirements and the pseudocode above, generate the ${fileExtension} code for it, and make a class out of the pseudocode. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, project.id);
    //       if (result.length > 0) {
    //         try {
    //           result = result.replace('undefined', '').replace('```python', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
    //           result = result.replace('undefined', '').replace('```c', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
    //           fs.writeFileSync(filename, result);
    //           // 将 result 按行拆分并生成 structuredArray
    //           const structuredArray = result.split('\n').map(line => ({
    //             type: 0,
    //             content: line.trim() // 去掉行首尾的空格
    //           }));
    //           // 构造新文件名
    //           let filename1 = filename.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
    //           // 设置文件输出路径
    //           const outputPath = path.resolve(__dirname, filename1);
    //           // 将 structuredArray 写入 JSON 文件
    //           fs.writeFileSync(outputPath, JSON.stringify(structuredArray, null, 2), 'utf-8');
    //           console.log(`文件 "${filename}" 已创建并写入内容。`);
    //           webviewViewProvider?.able();
    //         } catch (error) {
    //           console.error(`创建文件"${filename}"时出错: ` + error);
    //           webviewViewProvider?.able();
    //         }
    //       }
    //     }
    //     // 对比新旧代码并高亮显示
    //     if (project && currentCode.length > 0) {
    //       project_id = project.id;
    //       decontext(project_id);
    //       if (instructionContent) {
    //         currentCode = instructionContent + "\n" + currentCode;
    //       }
    //       result = await askAI(selectedText + `The above content is part of the pseudocode you previously generated for one module. Based on the overall project requirements and the pseudocode above, modify the existing code ${currentCode} to generate the ${fileExtension} code, ensuring that both the original and new functionalities work correctly. Remember to make it a class. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, project.id);
    //       if (result.length > 0) {
    //         try {
    //           result = result.replace('undefined', '').replace('```python', '').replace('```c', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
    //           fs.writeFileSync(filename, result);
    //           // 将 result 按行拆分并生成 structuredArray
    //           const structuredArray = result.split('\n').map(line => ({
    //             type: 0,
    //             content: line.trim() // 去掉行首尾的空格
    //           }));
    //           // 构造新文件名
    //           let filename1 = filename.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
    //           // 设置文件输出路径
    //           const outputPath = path.resolve(__dirname, filename1);
    //           // 将 structuredArray 写入 JSON 文件
    //           fs.writeFileSync(outputPath, JSON.stringify(structuredArray, null, 2), 'utf-8');
    //           console.log(`文件 "${filename}" 已创建并写入内容。`);
    //           webviewViewProvider?.able();
    //         } catch (error) {
    //           console.error(`创建文件"${filename}"时出错: ` + error);
    //           webviewViewProvider?.able();
    //         }
    //       }
    //       let comparisonResult = "";
    //       comparisonResult = await askAI(
    //         `Below is the current code and the newly generated code. Please compare them line by line and provide the newly generated code along with its status on a per-line basis. Return only the newly generated code, marking modified lines with a highlight indicator:
    //           take the following 2 lines as an example:
    //           1 or 0 (where 1 indicates highlighting is required, 0 indicates no highlighting is needed).
    //           import os (Content of this line of code)

    //           For other unchanged lines in the original code, if a type exists, retain the previous type as specified in ${codeType}.
    //           Current code: ${currentCode}
    //           Newly generated code: ${result}
    //           Do not add any extra content, including comments.`, project_id
    //       );
    //       const baseFileName = fileName.substring(0, fileName.lastIndexOf('.'));
    //       const modifiedFileExtension = fileExtension.replace('.', '_');
    //       const comparisonResultFilename = baseFileName + `${modifiedFileExtension}.json`;
    //       const res = parseCodeToStructure(comparisonResult, comparisonResultFilename);
    //       try {
    //         fs.writeFileSync(comparisonResultFilename, JSON.stringify(res, null, 2), 'utf8'); // 保存结构体信息
    //         console.log(`文件"${comparisonResultFilename}" 已创建并写入内容。`);
    //         webviewViewProvider?.able();
    //       } catch (error) {
    //         console.error(`创建文件 "${comparisonResultFilename}" 时出错: ` + error);
    //         webviewViewProvider?.able();
    //       }
    //     }
    //     const goat = filename;
    //     const fileContent = 'Pseudo-code has not been generated yet.';
    //     try {
    //       await fs.promises.access(goat);
    //       console.log('File exists, opening...');
    //       // 打开文件
    //       vscode.workspace.openTextDocument(goat).then(doc => {
    //         vscode.window.showTextDocument(doc, {
    //           preview: false, // 不使用预览模式
    //           viewColumn: vscode.ViewColumn.Beside // 在旁边的一个新窗口中打开
    //         });
    //       }, err => {
    //         vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
    //       });
    //     } catch (error) {
    //       console.log('File does not exist, creating...');
    //       try {
    //         await fs.promises.writeFile(goat, fileContent);
    //         console.log('File created successfully');
    //         await fs.promises.access(goat);
    //         console.log('File exists, opening...');
    //         // 打开文件
    //         vscode.workspace.openTextDocument(goat).then(doc => {
    //           vscode.window.showTextDocument(doc, {
    //             preview: false, // 不使用预览模式
    //             viewColumn: vscode.ViewColumn.Beside // 在旁边的一个新窗口中打开
    //           });
    //         }, err => {
    //           vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
    //         });
    //       } catch (error) {
    //         console.error('Error creating file:', error);
    //       }
    //     }
    //   })();
    // }),
    vscode.commands.registerCommand('CodeToolBox.code', () => {
      (async () => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
              vscode.window.showInformationMessage('No editor is active');
              return;
          }
          const selectedText = editor.document.getText(editor.selection);
          // 使用正则表达式提取路径
          const regex = /\/\/ --- 来源: (.+?) ---/g;
          let match;
          const paths = [];
          while ((match = regex.exec(selectedText)) !== null) {
            const path = match[1].trim();
            if ((path.match(/\\/g) || []).length === 3) {
                paths.push(path);
            }
          }
          const language = vscode.workspace.getConfiguration('ai').get('language') + "";
          const fileExtension: string = getFileExtension(language);
          const modelPath = vscode.workspace.getConfiguration('ai').get('path') + "";
          let currentCode = '';
          let openCount = 0;
          for (const relativePath of paths) {
              let content: string | null = null;
              content= extractAlgorithm(selectedText, relativePath);
            if (content) {
                console.log(content);
            } else {
                console.log(relativePath+"路径不存在");
            }
              const originalDir = path.dirname(relativePath);
              const fullPath = path.join(modelPath, originalDir, 'content' + fileExtension);
              if (fs.existsSync(fullPath)) {
                currentCode = fs.readFileSync(fullPath, 'utf-8');
              } else {
                  console.log(`文件不存在: ${fullPath}`);
              }
              let result = "";
              const firstLevelFolder = relativePath.split('\\')[0];
              console.log("selectedText:"+relativePath+content);
              if(currentCode.length === 0){
                result = await askAI(content + `The above content is the pseudocode for one module. Based on the overall project requirements and the pseudocode above, generate the ${fileExtension} code for it, and make a class out of the pseudocode. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, firstLevelFolder);
              }
              else{
                result = await askAI(content + `The above content is part of the pseudocode you previously generated for one module. Based on the overall project requirements and the pseudocode above, modify the existing code ${currentCode} to generate the ${fileExtension} code, ensuring that both the original and new functionalities work correctly. Remember to make it a class. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, firstLevelFolder);
              }
              // 保存生成的代码到文件
              result= result.replace(/undefined/g, '').replace(/```python/g, '').replace(/```c/g, '').replace(/```java/g, '');
              fs.writeFileSync(fullPath, result);
              console.log(`文件 "${fullPath}" 已创建并写入内容。`);
              openCount++;
              // 打开生成的文件
              const viewColumn = openCount === 1 ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
              // 打开生成的文件
              try {
                  await vscode.workspace.openTextDocument(fullPath).then(doc => {
                      vscode.window.showTextDocument(doc, {
                          preview: false, // 不使用预览模式
                          viewColumn: viewColumn // 使用计算后的视图列
                      });
                  });
              } catch (error) {
                  // 处理打开文件时的错误
                  // vscode.window.showErrorMessage(`打开文件时出错: ${error.message}`);
              }
          }
      })();
  }),
    vscode.commands.registerCommand('CodeToolBox.mergeall', () => {
      (async () => {
        webviewViewProvider?.disable()
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No active editor!');
          webviewViewProvider?.able()
          return;
        }
        const document = editor.document;
        const content = document.getText();
        const language = vscode.workspace.getConfiguration('ai').get('language') + "";
        const fileExtension: string = getFileExtension(language);

        const fileName = document.fileName;

        const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
        const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
        let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
        let res = "";
        //文件路径
        const filename = fileName.substring(0, fileName.lastIndexOf('.')) + `${fileExtension}`;
        if (project) {
          res = await askAI(content + `The above content is the pseudocode you previously generated for one module, which I want to use as the main module. Based on the interfaces of the various modules you just generated, please create the ${fileExtension} code for the main game module. Additionally, generate its ${fileExtension} code according to the pseudocode above. Remember to make it a class. The final result should contain only the code without any additional information, and I want to write it to a file named ${filename}. Note that the code should include a main function as the entry point for the entire project, and you only need to generate the code for this module without considering other modules`, project.id)
        }
        try {
          // 创建文件并写入内容
          fs.writeFileSync(filename, ex(res).content);
          console.log(`文件 "${filename}" 已创建并写入内容。`);
          webviewViewProvider?.able()
        } catch (error) {
          console.error(`创建文件 "${filename}" 时出错: ` + error);
          webviewViewProvider?.able()
        }
      })();
    }),
    vscode.commands.registerCommand('CodeToolBox.divideBlocks', () => {
      (async () => {
        webviewViewProvider?.disable()
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No active editor!');
          webviewViewProvider?.able()
          return;
        }
        const document = editor.document;
        const content = document.getText();
        const fileName = document.fileName;
        const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
        const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
        let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
        let res = "";
        //文件路径
        if (project) {
          res = await askAI(content + `The above content is the pseudocode you previously generated for one module.I need you to divide the pseudocode into several blocks.A code block is a group of statements or instructions enclosed within specific delimiters that are treated as a single unit of code. Note that you should only add the annotation beginning with 'block'+ index.without altering any pseudocode or adding any other information.`, project.id)
        }
        try {
          // 创建文件并写入内容
          fs.writeFileSync(fileName, ex1(res).content);
          console.log(`文件 "${fileName}" 已创建并写入内容。`);
          webviewViewProvider?.able()
        } catch (error) {
          console.error(`写入文件 "${fileName}" 时出错: ` + error);
          webviewViewProvider?.able()
        }
      })();
    })
  )
  interface FileData {
    name: string;
    content: string;
  }

}
