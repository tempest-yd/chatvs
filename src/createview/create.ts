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
// 获取扩展的根路径
// 遍历模块数组
interface Module {
  module: string;
  functionality: string[];
  pseudoCode: string;
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
          case 'updateproject':
            (async () => {

              const res = await askAI(message.con + "Below are your specific requirements: In your response, all colons should use English colons:, and the response format should strictly follow each module's format as ###Module:Moudule name,@@@ability:Moudule ability,&&&Pseudocode:Pseudocode content. The response content should be in English. Here are the specific operations: First, you need to divide this project into modules, and the specific number of modules should be determined based on the difficulty of the requirements. The more difficult the project, the more modules should be divided. Regardless of how many modules you divide, they should form a complete project. The final result should be returned on a per-module basis, with each module containing the module name (no spaces allowed in the module name), a description of the functionality (the description should be concise and no more than 10 words), and pseudocode (the specific content of the pseudocode should be enclosed in ```" + `Learn from the following pseudocode example and then generate the corresponding pseudocode based on my requirements. Example:${alarmManagementCode}` + ".In each module, the name section should start with '###', the functionality section should start with '@@@', and the pseudocode section should start with '&&&'.", message.index);
              //const res = '### 模块名：游戏初始化@@@ 功能：初始化游戏棋盘和玩家信息&&& 伪代码：```function initializeGame():    创建一个空的五子棋棋盘    初始化玩家1和玩家2的名称    将当前回合设置为玩家1```### 模块名：绘制棋盘@@@ 功能：在控制台上绘制当前状态的五子棋棋盘&&& 伪代码：```function drawBoard(board):    for each 行 in board:        for each 列 in 行:            if 列有落子:                打印对应的落子颜色符号（如黑方格B，白方格W）            else:                打印未落子标记（如空方格.）        打印换行符```### 模块名：下棋逻辑  @@@ 功能：“人机对战”模式下实现人类玩家和AI完成自己所选位置出成功能，并判断胜利条件是否达成。&&& 伪代码：```function makeMove(player, row, col):    if (row, col) 不是有效位置或者已经被落子了：        返回无效移动            如果 player 不是当前回合玩家：        返回轮到其他玩家提示       在指定位置(row, col)处放置player的棋子       如果检查连续相同颜色的任意直线中存在五个以上连续相同颜色则结束游戏并宣布胜利者；      下一步将执行AI行动；          更新轮到下一个回合              ```### 模块名：主函数调用@@@ 功能: 调用上述模块组成完整游戏程序流程，让用户持续循环进行操作(输入行/列)&&& 伪代码：``` function main():     初始化游戏          while 游戏没有结束:         绘制当前状态的五子棋盘                 提示当前回合是哪位玩家（如果是AI，则显示AI正在思考...）                 接收用户输入选择                             如果输入选择为退出，则结束循环且宣布退出。                          否则，                              解析用户输入，得到需要放置的位置                                     根据解析结果调用“下棋逻辑”模块来进行处理                     游戏结束时打印最后结果  main()```undefined'
              const segments: Module[] = extractCodeAndText(res);
              decontext(message.index)
              decontext(message.index)
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""


              let project = projects.find(project => project.id === message.index);

              if (project) {
                const basePath = path.join(model, project.name.replace(/:/g, '-'));
                project.segments = [];
                segments.forEach(segment => {

                  project.segments.push({ name: segment.module, id: new Date().toISOString() })
                  const fileName = `${segment.module}.pseudo`;
                  const filePath = path.join(basePath, fileName);
                  const content = segment.pseudoCode;
                  const language = vscode.workspace.getConfiguration('ai').get('language') + "";
                  const fileExtension: string = getFileExtension(language);
                  const filePath1 = path.join(basePath, segment.module + fileExtension);
                  const content1 = `还未生成${language}代码`;
                  try {
                    // 创建文件并写入内容
                    fs.writeFileSync(filePath, content);
                    fs.writeFileSync(filePath1, content1);
                    console.log(`文件 "${fileName}" 已创建并写入内容。`);
                  } catch (error) {
                    console.error(`创建文件 "${fileName}" 时出错: ` + error);
                  }

                });
                webviewView.webview.postMessage({ command: 'reupdateproject', segments: project.segments, ability: segments });
              }

              // 继续执行其他逻辑
            })();
            return;
          case 'makeproject':
            (async () => {
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              const patha = path.join(model, message.project.replace(/:/g, '-'));
              if (!fs.existsSync(patha)) {
                fs.mkdirSync(patha, { recursive: true });
              }
              projects.push({ id: message.project, name: message.project, segments: [] })
            })();
            webviewView.webview.postMessage({});
            return;
          case 'renameproject':
            (async () => {
              if (message.raw == message.name) {
                webviewView.webview.postMessage({ command: 'renamea', success: 0, index: message.index })
                return;
              }
              // 要重命名的文件路径
              const oldFileName = message.raw.replace(/:/g, '-');
              const newFileName = message.name;
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              // 获取文件的完整路径
              const oldFilePath = path.join(model, oldFileName);
              const newFilePath = path.join(model, newFileName);
              fs.access(newFilePath, fs.constants.F_OK, (err) => {
                if (!err) {
                  // 文件或文件夹已存在
                  vscode.window.showErrorMessage(`模块名${newFileName}重复`);
                  webviewView.webview.postMessage({ command: 'renamea', success: 0, index: message.index });
                } else {
                  // 使用 fs 模块重命名文件
                  fs.rename(oldFilePath, newFilePath, (erra) => {
                    if (erra) {
                      console.log(erra)
                      vscode.window.showErrorMessage("项目名不符合规范")
                      webviewView.webview.postMessage({ command: 'renamea', success: 0, index: message.index });
                    } else {
                      let project = projects.find(project => project.id === message.id);
                      if (project) {
                        project.name = newFileName
                      }
                      webviewView.webview.postMessage({ command: 'renamea', success: 1, index: message.index });
                    }
                  });
                }
              })
            })();
            webviewView.webview.postMessage({});
            return;
          case 'makefile':
            (async () => {
              const res = await askAI(message.con + "Generate pseudocode according to the above functionality so that I can directly write the final pseudocode into pseudo without returning extra text.", message.id);
              // 生成唯一的时间戳
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              const time1 = message.projectname.replace(/:/g, '-');
              const time2 = message.indexname.replace(/:/g, '-');
              const fileName = `pseudocode_${time2}.pseudo`;
              const filePath = path.join(model, time1, fileName);

              // 创建文件并写入内容
              fs.writeFileSync(filePath, res);
              // 在 VS Code 中打开文件
              vscode.workspace.openTextDocument(filePath).then(doc => {
                vscode.window.showTextDocument(doc);
              }, err => {
                vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
              });
            })();
            webviewView.webview.postMessage({});
            return;
          case 'addmodel':
            (async () => {
              let project = projects.find(project => project.id === message.project);
              if (project) {
                project.segments.push({ id: message.index, name: message.index })
              }
              //定义语言变量
              const language = vscode.workspace.getConfiguration('ai').get('language') + "";  // 可以设置为 'java', 'python', 'javascript', 等等
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""

              //文件内容
              const fileContent: string = `// This is a sample ${language} file`;
              //文件路径
              const fileExtension: string = getFileExtension(language);
              const fileName1: string = message.index + `${fileExtension}`;
              const fileName: string = message.index + '.pseudo';

              if (project) {
                const filePath1: string = path.join(model, project.name.replace(/:/g, '-'), fileName1.replace(/:/g, '-'));
                const filePath: string = path.join(model, project.name.replace(/:/g, '-'), fileName.replace(/:/g, '-'));
                // 创建并写入文件
                try {
                  // 创建文件并写入内容
                  fs.writeFileSync(filePath, "123");
                  fs.writeFileSync(filePath1, "这是一个空的伪代码文件等待生成");
                } catch (error) {
                  console.error(`创建文件 "${fileName}" 时出错: ` + error);
                }
              }
            })();

            webviewView.webview.postMessage({});
            return;
          case 'renamemodel':
            (async () => {
              let project = projects.find(project => project.id === message.proid);
              if (message.raw == message.name) {
                webviewView.webview.postMessage({ command: 'renamemodel', success: 0, index: message.index })
                return;
              }
              // 要重命名的文件路径
              if (project) {
                const time1 = project.name.replace(/:/g, '-');

                const oldFileName = message.raw.replace(/:/g, '-');
                const newFileName = message.name;
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""

                //定义语言变量
                const language = vscode.workspace.getConfiguration('ai').get('language') + "";  // 可以设置为 'java', 'python', 'javascript', 等等
                //文件路径
                const fileExtension: string = getFileExtension(language);
                const fileName1: string = oldFileName + `${fileExtension}`;
                const fileName2: string = newFileName + `${fileExtension}`;
                // 获取文件的完整路径
                const oldFilePath = path.join(model, time1, fileName1);
                const newFilePath = path.join(model, time1, fileName2);
                // 使用 fs 模块重命名文件
                fs.access(newFilePath, fs.constants.F_OK, (err) => {
                  if (!err) {
                    // 文件或文件夹已存在
                    vscode.window.showErrorMessage(`模块名${newFileName}重复`);
                    webviewView.webview.postMessage({ command: 'renamemodel', success: 0, index: message.index });
                  } else {
                    fs.rename(oldFilePath, newFilePath, (erra) => {
                      if (erra) {
                        console.log(erra)
                        vscode.window.showErrorMessage(`模块名${newFileName}不符合规范`)
                        webviewView.webview.postMessage({ command: 'renamemodel', success: 0, index: message.index });
                        return;
                      } else {
                        let pro = project.segments.find(pro => pro.id === message.id);
                        if (pro) {
                          pro.name = newFileName
                        }
                        webviewView.webview.postMessage({ command: 'renamemodel', success: 1, index: message.index });
                      }
                    });
                  }
                })

                //文件路径
                const fileName3: string = oldFileName + '.pseudo';
                const fileName4: string = newFileName + '.pseudo';
                // 获取文件的完整路径
                const oldFilePath1 = path.join(model, time1, fileName3);
                const newFilePath1 = path.join(model, time1, fileName4);
                // 使用 fs 模块重命名文件
                fs.access(newFilePath1, fs.constants.F_OK, (err) => {
                  if (!err) {
                    // 文件或文件夹已存在
                    vscode.window.showErrorMessage(`模块名${newFileName}重复`);
                    webviewView.webview.postMessage({ command: 'renamemodel', success: 0, index: message.index });
                  } else {
                    fs.rename(oldFilePath1, newFilePath1, (erra) => {
                      if (erra) {
                        console.log(erra)
                        vscode.window.showErrorMessage(`模块名${newFileName}不符合规范`)
                        webviewView.webview.postMessage({ command: 'renamemodel', success: 0, index: message.index });
                        return;
                      } else {
                        let pro = project.segments.find(pro => pro.id === message.id);
                        if (pro) {
                          pro.name = newFileName
                        }
                        webviewView.webview.postMessage({ command: 'renamemodel', success: 1, index: message.index });
                      }
                    });
                  }
                })
              }
            })();
            return;
          case 'openfile':
            (async () => {
              if (message.num == 1) {
                // 打开伪代码
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                const time1 = message.projectname.replace(/:/g, '-');
                const time2 = message.indexname.replace(/:/g, '-');
                const fileName = `${time2}.pseudo`;
                const filePath = path.join(model, time1, fileName);
                const fileContent = '还未生成伪代码';
                try {
                  await fs.promises.access(filePath);
                  console.log('File exists, opening...');
                  // 打开文件
                  vscode.workspace.openTextDocument(filePath).then(doc => {
                    vscode.window.showTextDocument(doc);
                  }, err => {
                    vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
                  });
                } catch (error) {
                  console.log('File does not exist, creating...');
                  try {
                    await fs.promises.writeFile(filePath, fileContent);
                    console.log('File created successfully');
                    await fs.promises.access(filePath);
                    console.log('File exists, opening...');
                    // 打开文件
                    vscode.workspace.openTextDocument(filePath).then(doc => {
                      vscode.window.showTextDocument(doc);
                    }, err => {
                      vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
                    });
                  } catch (error) {
                    console.error('Error creating file:', error);
                  }
                }
              } else {
                // 打开代码
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                const time1 = message.projectname.replace(/:/g, '-');
                const time2 = message.indexname.replace(/:/g, '-');
                const language = vscode.workspace.getConfiguration('ai').get('language') + "";
                const fileExtension: string = getFileExtension(language);
                const fileName: string = time2 + `${fileExtension}`;
                const filePath = path.join(model, time1, fileName);
                const fileContent = '还未生成代码';
                try {
                  await fs.promises.access(filePath);
                  console.log('File exists, opening...');
                  // 打开文件
                  vscode.workspace.openTextDocument(filePath).then(doc => {
                    vscode.window.showTextDocument(doc);
                  }, err => {
                    vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
                  });
                } catch (error) {
                  console.log('File does not exist, creating...');
                  try {
                    await fs.promises.writeFile(filePath, fileContent);
                    console.log('File created successfully');
                    await fs.promises.access(filePath);
                    console.log('File exists, opening...');
                    // 打开文件
                    vscode.workspace.openTextDocument(filePath).then(doc => {
                      vscode.window.showTextDocument(doc);
                    }, err => {
                      vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
                    });
                  } catch (error) {
                    console.error('Error creating file:', error);
                  }
                }
              }
            })();
            webviewView.webview.postMessage({});
            return;
          case "deletemodel":
            (async () => {
              const time1 = message.proname.replace(/:/g, '-');
              const FileName = message.modelname.replace(/:/g, '-');;
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""

              //定义语言变量
              const language = vscode.workspace.getConfiguration('ai').get('language') + "";  // 可以设置为 'java', 'python', 'javascript', 等等
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
                  // 添加其他语言及其文件扩展名
                  default:
                    throw new Error('Unsupported language type');
                }
              };
              //文件路径
              const fileExtension: string = getFileExtension(language);
              const fileName1: string = FileName + `${fileExtension}`;
              const fileName2: string = FileName + '.pseudo';
              // 获取文件的完整路径
              const FilePath1 = path.join(model, time1, fileName1);
              // 获取文件的完整路径
              const FilePath2 = path.join(model, time1, fileName2);
              await fs.remove(FilePath1);
              await fs.remove(FilePath2);
            })();
            webviewView.webview.postMessage({});

          case 'addproject':
            (async () => {
              const model = vscode.workspace.getConfiguration('ai').get('propath') + ""
              const result: Module[] = [];
              const a: { con: string; name: string }[] = [];
              const language = vscode.workspace.getConfiguration('ai').get('language') + "";
              const fileExtension: string = getFileExtension(language);
              // 读取目录中的所有文件
              fs.readdirSync(model).forEach(file => {
                const filePath = path.join(model, file);

                // 检查是否为文件
                if (fs.statSync(filePath).isFile() && file.endsWith(fileExtension)) {
                  // 读取文件内容
                  const content = fs.readFileSync(filePath, 'utf-8');
                  a.push({ con: content, name: file });
                }
              });
              const mod = vscode.workspace.getConfiguration('ai').get('path') + ""
              const parts = model.split('\\'); // Split by backslashes
              const patha = path.join(mod, parts[parts.length - 1]);
              if (!fs.existsSync(patha)) {
                fs.mkdirSync(patha, { recursive: true });
              }
              for (const se of a) {
                const res = await askAI(se.con + "Below are your specific requirements: In your response, all colons should use English colons (:), and the format should strictly follow each module’s format as ###Module:Moudule name,@@@ability:Moudule ability,&&&Pseudocode:Pseudocode content; the response should be in English. Here are the specific steps: First, you need to understand this code, then give this code a filename (no spaces allowed in the name), describe its functionality (the description should be concise, no more than 10 words), and generate the corresponding pseudocode for this code (enclose the pseudocode content in ```)" + `Learn from the following pseudocode example, then generate the corresponding pseudocode based on my requirements.example:${alarmManagementCode}` + "In each section, start the name with '###', the functionality description with '@@@', and the pseudocode section with '&&&'.", message.index);
                let segments: Module = extractCodeAndText(res)[0];

                const re = removeExtension(se.name, fileExtension); // result: "example"
                segments.module = re
                result.push(segments)

              }
              projects.push({ id: message.index, name: parts[parts.length - 1], segments: [] })
              //const res = '### 模块名：游戏初始化@@@ 功能：初始化游戏棋盘和玩家信息&&& 伪代码：```function initializeGame():    创建一个空的五子棋棋盘    初始化玩家1和玩家2的名称    将当前回合设置为玩家1```### 模块名：绘制棋盘@@@ 功能：在控制台上绘制当前状态的五子棋棋盘&&& 伪代码：```function drawBoard(board):    for each 行 in board:        for each 列 in 行:            if 列有落子:                打印对应的落子颜色符号（如黑方格B，白方格W）            else:                打印未落子标记（如空方格.）        打印换行符```### 模块名：下棋逻辑  @@@ 功能：“人机对战”模式下实现人类玩家和AI完成自己所选位置出成功能，并判断胜利条件是否达成。&&& 伪代码：```function makeMove(player, row, col):    if (row, col) 不是有效位置或者已经被落子了：        返回无效移动            如果 player 不是当前回合玩家：        返回轮到其他玩家提示       在指定位置(row, col)处放置player的棋子       如果检查连续相同颜色的任意直线中存在五个以上连续相同颜色则结束游戏并宣布胜利者；      下一步将执行AI行动；          更新轮到下一个回合              ```### 模块名：主函数调用@@@ 功能: 调用上述模块组成完整游戏程序流程，让用户持续循环进行操作(输入行/列)&&& 伪代码：``` function main():     初始化游戏          while 游戏没有结束:         绘制当前状态的五子棋盘                 提示当前回合是哪位玩家（如果是AI，则显示AI正在思考...）                 接收用户输入选择                             如果输入选择为退出，则结束循环且宣布退出。                          否则，                              解析用户输入，得到需要放置的位置                                     根据解析结果调用“下棋逻辑”模块来进行处理                     游戏结束时打印最后结果  main()```undefined'
              let project = projects.find(project => project.id === message.index);

              if (project) {
                const basePath = path.join(mod, project.name.replace(/:/g, '-'));
                project.segments = [];
                result.forEach((segment, index) => {

                  project.segments.push({ name: segment.module, id: new Date().toISOString() })
                  const fileName = `${segment.module}.pseudo`;
                  const filePath = path.join(basePath, fileName);
                  const content = segment.pseudoCode;
                  const language = vscode.workspace.getConfiguration('ai').get('language') + "";
                  const fileExtension: string = getFileExtension(language);
                  const filePath1 = path.join(basePath, segment.module + fileExtension);
                  const content1 = `${a[index].con}`;
                  try {
                    // 创建文件并写入内容
                    fs.writeFileSync(filePath, content);
                    fs.writeFileSync(filePath1, content1);
                    console.log(`文件 "${fileName}" 已创建并写入内容。`);
                  } catch (error) {
                    console.error(`创建文件 "${fileName}" 时出错: ` + error);
                  }

                });
                webviewView.webview.postMessage({ command: 'addproject', segments: project.segments, ability: result, id: message.index ,name:parts[parts.length - 1]});
              }
            })();
            return
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
    vscode.commands.registerCommand('CodeToolBox.pseudocode', () => {
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
        const filename = fileName.substring(0, fileName.lastIndexOf('.')) + ".pseudo";

        const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
        const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
        let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
        let res = "";
        if (project) {
          res = await askAI(content + "Based on the code above, generate pseudocode for it, and make a class out of the pseudocode. The final result should contain only the pseudocode without any additional information. The pseudocode should be in natural language, without using programming language syntax!", project.id)
        }
        try {
          // 创建文件并写入内容
          fs.writeFileSync(filename, ex(res).content);
          console.log(`文件 "${fileName}" 已创建并写入内容。`);
          webviewViewProvider?.able()
        } catch (error) {
          console.error(`创建文件 "${fileName}" 时出错: ` + error);
          webviewViewProvider?.able()
        }
      })();
    }),
    vscode.commands.registerCommand('CodeToolBox.code', () => {
      (async () => {
        webviewViewProvider?.disable();
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No editor is active');
          return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
          vscode.window.showInformationMessage('No text selected');
          webviewViewProvider?.able();
          return;
        }
        const selectedText = editor.document.getText(selection); // 获取选中的文本
        const document = editor.document;
        const language = vscode.workspace.getConfiguration('ai').get('language') + "";
        const fileExtension: string = getFileExtension(language);
        const fileName = document.fileName;
        const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
        const filename1 = fileType1.substring(0, fileType1.lastIndexOf('.'));
        let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') === filename1)));
        let result = "";
        let currentCode = "";
        let project_id = '';

        const instructionFilePath = fileName.substring(0, fileName.lastIndexOf('.')) + ".txt";
        let instructionContent = "";
        if (fs.existsSync(instructionFilePath)) {
          instructionContent = fs.readFileSync(instructionFilePath, 'utf8');
          console.log(`Read instruction from ${instructionFilePath}`);
        } else {
          console.log(`File ${instructionFilePath} does not exist.`);
        }
        // 文件路径
        const filename = fileName.substring(0, fileName.lastIndexOf('.')) + `${fileExtension}`;
        if (fs.existsSync(filename)) {
          currentCode = fs.readFileSync(filename, 'utf8');
          if (currentCode === "还未生成python代码") { currentCode = ""; }
          console.log(`File ${filename} exists. Reading currentCode from ${filename}，${currentCode}`)
        } else {
          console.log(`File ${filename} does not exist. Proceeding without current code "${filename}".`);
        }
        const codeTypeFile = fileName.substring(0, fileName.lastIndexOf('.')) + '_pseudo.json';
        let codeType = "";
        if (fs.existsSync(codeTypeFile)) {
          codeType = fs.readFileSync(codeTypeFile, 'utf8');
          console.log(`File ${codeTypeFile} exists. Reading currentCode from ${codeTypeFile}`);
        }
        console.log(currentCode.length);
        if (project && !(currentCode.length > 0)) {
          if (instructionContent) {
            currentCode = instructionContent + "\n" + currentCode;
          }
          project_id = project.id;
          decontext(project_id);
          result = await askAI(selectedText + `The above content is part of the pseudocode you previously generated for one module. Based on the overall project requirements and the pseudocode above, generate the ${fileExtension} code for it, and make a class out of the pseudocode. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, project.id);
          if (result.length > 0) {
            try {
              result = result.replace('undefined', '').replace('```python', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
              result = result.replace('undefined', '').replace('```c', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
              fs.writeFileSync(filename, result);
              // 将 result 按行拆分并生成 structuredArray
              const structuredArray = result.split('\n').map(line => ({
                type: 0,
                content: line.trim() // 去掉行首尾的空格
              }));
              // 构造新文件名
              let filename1 = filename.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
              // 设置文件输出路径
              const outputPath = path.resolve(__dirname, filename1);
              // 将 structuredArray 写入 JSON 文件
              fs.writeFileSync(outputPath, JSON.stringify(structuredArray, null, 2), 'utf-8');
              console.log(`文件 "${filename}" 已创建并写入内容。`);
              webviewViewProvider?.able();
            } catch (error) {
              console.error(`创建文件"${filename}"时出错: ` + error);
              webviewViewProvider?.able();
            }
          }
        }
        // 对比新旧代码并高亮显示
        if (project && currentCode.length > 0) {
          project_id = project.id;
          decontext(project_id);
          if (instructionContent) {
            currentCode = instructionContent + "\n" + currentCode;
          }
          result = await askAI(selectedText + `The above content is part of the pseudocode you previously generated for one module. Based on the overall project requirements and the pseudocode above, modify the existing code ${currentCode} to generate the ${fileExtension} code, ensuring that both the original and new functionalities work correctly. Remember to make it a class. Note that you only need to generate the code for this module without considering other modules. The final result should contain only the code, without any additional information.`, project.id);
          if (result.length > 0) {
            try {
              result = result.replace('undefined', '').replace('```python', '').replace('```c', '').replace('```undefined', '').replace('```', '').replace('undefined', '');
              fs.writeFileSync(filename, result);
              // 将 result 按行拆分并生成 structuredArray
              const structuredArray = result.split('\n').map(line => ({
                type: 0,
                content: line.trim() // 去掉行首尾的空格
              }));
              // 构造新文件名
              let filename1 = filename.replace(/(?!\.pseudo$)\.[^.]+$/, '') + '_py_human.json';
              // 设置文件输出路径
              const outputPath = path.resolve(__dirname, filename1);
              // 将 structuredArray 写入 JSON 文件
              fs.writeFileSync(outputPath, JSON.stringify(structuredArray, null, 2), 'utf-8');
              console.log(`文件 "${filename}" 已创建并写入内容。`);
              webviewViewProvider?.able();
            } catch (error) {
              console.error(`创建文件"${filename}"时出错: ` + error);
              webviewViewProvider?.able();
            }
          }
          let comparisonResult = "";
          comparisonResult = await askAI(
            `Below is the current code and the newly generated code. Please compare them line by line and provide the newly generated code along with its status on a per-line basis. Return only the newly generated code, marking modified lines with a highlight indicator:
              take the following 2 lines as an example:
              1 or 0 (where 1 indicates highlighting is required, 0 indicates no highlighting is needed).
              import os (Content of this line of code)

              For other unchanged lines in the original code, if a type exists, retain the previous type as specified in ${codeType}.
              Current code: ${currentCode}
              Newly generated code: ${result}
              Do not add any extra content, including comments.`, project_id
          );
          const baseFileName = fileName.substring(0, fileName.lastIndexOf('.'));
          const modifiedFileExtension = fileExtension.replace('.', '_');
          const comparisonResultFilename = baseFileName + `${modifiedFileExtension}.json`;
          const res = parseCodeToStructure(comparisonResult, comparisonResultFilename);
          try {
            fs.writeFileSync(comparisonResultFilename, JSON.stringify(res, null, 2), 'utf8'); // 保存结构体信息
            console.log(`文件"${comparisonResultFilename}" 已创建并写入内容。`);
            webviewViewProvider?.able();
          } catch (error) {
            console.error(`创建文件 "${comparisonResultFilename}" 时出错: ` + error);
            webviewViewProvider?.able();
          }
        }
        const goat = filename;
        const fileContent = 'Pseudo-code has not been generated yet.';
        try {
          await fs.promises.access(goat);
          console.log('File exists, opening...');
          // 打开文件
          vscode.workspace.openTextDocument(goat).then(doc => {
            vscode.window.showTextDocument(doc, {
              preview: false, // 不使用预览模式
              viewColumn: vscode.ViewColumn.Beside // 在旁边的一个新窗口中打开
            });
          }, err => {
            vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
          });
        } catch (error) {
          console.log('File does not exist, creating...');
          try {
            await fs.promises.writeFile(goat, fileContent);
            console.log('File created successfully');
            await fs.promises.access(goat);
            console.log('File exists, opening...');
            // 打开文件
            vscode.workspace.openTextDocument(goat).then(doc => {
              vscode.window.showTextDocument(doc, {
                preview: false, // 不使用预览模式
                viewColumn: vscode.ViewColumn.Beside // 在旁边的一个新窗口中打开
              });
            }, err => {
              vscode.window.showErrorMessage(`打开文件时出错: ${err.message}`);
            });
          } catch (error) {
            console.error('Error creating file:', error);
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
