import * as vscode from 'vscode';

import {getHtmlForWebview} from "../viewutil/webview";
import {askAI} from "../openai/keycheck"
import { text } from 'stream/consumers';
import {extractCodeAndText} from '../tools/re'
import {ex} from '../tools/ex'
import * as path from 'path';
import * as fs from 'fs-extra';
import { exec } from 'child_process';
import { projects } from '../extension';
import {creatfile} from "../tools/creatfile"
import * as JSON5 from 'json5';
  // 创建一个 webview 视图
  let webviewViewProvider: MyWebviewViewProvider | undefined;
  // 获取扩展的根路径
  // 遍历模块数组
  interface Module {
    module: string;
    functionality: string[];
    pseudoCode:string;
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
    webviewView.webview.html = getHtmlForWebview(webviewView,this.context);

    
    
    //收消息
    webviewView.webview.onDidReceiveMessage(
      
      message => {
        switch (message.command) {
          case 'updateproject':
            (async () => {
              const res = await askAI(message.con + "下面是你输出的具体要求：你回答的内容中所有冒号都采用英文冒号:，你回答的格式采用每个模块的格式严格按照###Module:Moudule name,@@@ablility:Moudule ability,&&&Pseudocode:```Pseudocode content```，回答内容都是用英文。下面是具体操作，你首先需要把这个项目分成模块，模块的具体的个数要根据需求的难易程度来衡量，项目越难分出的模块越多，项目越复杂分出的模块越少,无论你分成多少模块，他们组成的都应该是完整的项目。最终的结果以模块为单位返回，每个模块中包含模块名字(模块名字中不允许出现空格)，实现的功能（功能只需要文字叙述即可）和伪代码（伪代码具体内容使用```包围,伪代码采用自然语言不要使用代码语言！！），在每个模块中的名字部分的开头加上'###'，每个模块中的功能部分的开头加上'@@@'，每个模块伪代码部分的开头加上'&&&'。",message.index);
              //const res = '### 模块名：游戏初始化@@@ 功能：初始化游戏棋盘和玩家信息&&& 伪代码：```function initializeGame():    创建一个空的五子棋棋盘    初始化玩家1和玩家2的名称    将当前回合设置为玩家1```### 模块名：绘制棋盘@@@ 功能：在控制台上绘制当前状态的五子棋棋盘&&& 伪代码：```function drawBoard(board):    for each 行 in board:        for each 列 in 行:            if 列有落子:                打印对应的落子颜色符号（如黑方格B，白方格W）            else:                打印未落子标记（如空方格.）        打印换行符```### 模块名：下棋逻辑  @@@ 功能：“人机对战”模式下实现人类玩家和AI完成自己所选位置出成功能，并判断胜利条件是否达成。&&& 伪代码：```function makeMove(player, row, col):    if (row, col) 不是有效位置或者已经被落子了：        返回无效移动            如果 player 不是当前回合玩家：        返回轮到其他玩家提示       在指定位置(row, col)处放置player的棋子       如果检查连续相同颜色的任意直线中存在五个以上连续相同颜色则结束游戏并宣布胜利者；      下一步将执行AI行动；          更新轮到下一个回合              ```### 模块名：主函数调用@@@ 功能: 调用上述模块组成完整游戏程序流程，让用户持续循环进行操作(输入行/列)&&& 伪代码：``` function main():     初始化游戏          while 游戏没有结束:         绘制当前状态的五子棋盘                 提示当前回合是哪位玩家（如果是AI，则显示AI正在思考...）                 接收用户输入选择                             如果输入选择为退出，则结束循环且宣布退出。                          否则，                              解析用户输入，得到需要放置的位置                                     根据解析结果调用“下棋逻辑”模块来进行处理                     游戏结束时打印最后结果  main()```undefined'
              const segments : Module[] = extractCodeAndText(res);

              const model = vscode.workspace.getConfiguration('ai').get('path') + ""


              let project = projects.find(project => project.id === message.index);

              if(project){
                const basePath = path.join(model, project.name.replace(/:/g, '-'));
                project.segments = [];
                segments.forEach(segment => {

                    project.segments.push({name:segment.module,id:new Date().toISOString()})
                    const fileName = `${segment.module}.txt`;
                    const filePath = path.join(basePath, fileName);
                    const content = segment.pseudoCode;
                    const language = vscode.workspace.getConfiguration('ai').get('language') + "";
                    const fileExtension: string = getFileExtension(language);
                    const filePath1 = path.join(basePath,segment.module + fileExtension);
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
                webviewView.webview.postMessage({ command: 'reupdateproject' ,segments:project.segments,ability:segments});
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
              projects.push({id:message.project,name:message.project,segments:[]})
            })();	
            webviewView.webview.postMessage({});
            return;
          case 'renameproject':
            (async () => {
              if(message.raw == message.name){
                webviewView.webview.postMessage({ command: 'renamea',success:0 ,index:message.index})
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
                        webviewView.webview.postMessage({ command: 'renamea',success:0 ,index:message.index});
                      } else {
                        let project = projects.find(project => project.id === message.id);
                        if(project){
                          project.name = newFileName
                        }
                        webviewView.webview.postMessage({ command: 'renamea',success:1,index:message.index });
                      }
                  });
                }
              })
            })();	
            webviewView.webview.postMessage({});
            return;
          case 'makefile':
            (async () => {
              const res = await askAI(message.con + "根据我上面的功能生成伪代码，让我能把最后的伪代码直接写进txt里面，不要返回多余文字",message.id);
                // 生成唯一的时间戳
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                const time1 = message.projectname.replace(/:/g, '-');
                const time2 = message.indexname.replace(/:/g, '-');
              const fileName = `pseudocode_${time2}.txt`;
                const filePath = path.join(model,time1, fileName);

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
            (async () =>{
              let project = projects.find(project => project.id === message.project);
              if(project){
                project.segments.push({id:message.index,name:message.index})
              }
               //定义语言变量
              const language = vscode.workspace.getConfiguration('ai').get('language') + "";  // 可以设置为 'java', 'python', 'javascript', 等等
              const model = vscode.workspace.getConfiguration('ai').get('path') + ""
              
              //文件内容
              const fileContent: string = `// This is a sample ${language} file`;
              //文件路径
              const fileExtension: string = getFileExtension(language);
              const fileName1: string = message.index + `${fileExtension}`;
              const fileName: string = message.index + '.txt';

              if(project){
                const filePath1: string = path.join(model,project.name.replace(/:/g, '-'), fileName1.replace(/:/g, '-'));
                const filePath: string = path.join(model,project.name.replace(/:/g, '-'), fileName.replace(/:/g, '-'));
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
              if(message.raw == message.name){
                webviewView.webview.postMessage({ command: 'renamemodel',success:0 ,index:message.index})
                return;
              }
              // 要重命名的文件路径
              if(project){
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
                const oldFilePath = path.join(model,time1, fileName1);
                const newFilePath = path.join(model, time1,fileName2);
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
                        webviewView.webview.postMessage({ command: 'renamemodel',success:0 ,index:message.index});
                        return;
                      } else {
                        let pro = project.segments.find(pro => pro.id === message.id);
                        if(pro){
                          pro.name = newFileName
                        }
                        webviewView.webview.postMessage({ command: 'renamemodel',success:1,index:message.index });
                      }
                    }); 
                  }
                })

                //文件路径
                const fileName3: string = oldFileName + '.txt';
                const fileName4: string = newFileName + '.txt';
                // 获取文件的完整路径
                const oldFilePath1 = path.join(model,time1, fileName3);
                const newFilePath1 = path.join(model, time1,fileName4);
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
                        webviewView.webview.postMessage({ command: 'renamemodel',success:0 ,index:message.index});
                        return;
                      } else {
                        let pro = project.segments.find(pro => pro.id === message.id);
                        if(pro){
                          pro.name = newFileName
                        }
                        webviewView.webview.postMessage({ command: 'renamemodel',success:1,index:message.index });
                      }
                    });
                  }
                })
              }
            })();	
            return;
          case 'openfile':
            (async () =>{
              if(message.num == 1){
                // 打开伪代码
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                const time1 = message.projectname.replace(/:/g, '-');
                const time2 = message.indexname.replace(/:/g, '-');
                const fileName = `${time2}.txt`;
                const filePath = path.join(model,time1, fileName);
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
              }else{
                // 打开代码
                const model = vscode.workspace.getConfiguration('ai').get('path') + ""
                const time1 = message.projectname.replace(/:/g, '-');
                const time2 = message.indexname.replace(/:/g, '-');
                const language = vscode.workspace.getConfiguration('ai').get('language') + ""; 
                const fileExtension: string = getFileExtension(language);
                const fileName: string = time2 + `${fileExtension}`;
                const filePath = path.join(model,time1, fileName);
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
                    // 添加其他语言及其文件扩展名
                    default:
                      throw new Error('Unsupported language type');
                  }
                };  
                //文件路径
                const fileExtension: string = getFileExtension(language);
                const fileName1: string = FileName + `${fileExtension}`;
                const fileName2: string = FileName + '.txt';
                // 获取文件的完整路径
                const FilePath1 = path.join(model,time1, fileName1);
                // 获取文件的完整路径
                const FilePath2 = path.join(model,time1, fileName2);
                await fs.remove(FilePath1);
                await fs.remove(FilePath2);
            })();	
            webviewView.webview.postMessage({});
          }
      },
      undefined,
      this.context.subscriptions
    );
  }
  disable(){
    if(this.webview){
      this.webview.postMessage({command:"dis"});
    }
  }
  able(){
    if(this.webview){
      this.webview.postMessage({});
    }
  }
  addabilities(message:{project:string,model:string,con:string}){
    if(this.webview){
      this.webview.postMessage({ command: 'addabilities' ,project:message.project,model:message.model,con:message.con});
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
    case 'c++':
      return '.cpp'
    case 'html':
      return '.html'
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
            const filename = fileType.substring(0,fileType.lastIndexOf('.'));
            let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') ===filename)));

            if(project){
              let model = project?.segments.find(segment => segment.name.replace(/:/g, '-') ===filename)
              const result: string  =  await askAI(content + "请根据上面的代码或者伪代码，生成他们顺序实现了哪些功能，每个功能标为一行，要求简要概括。最终的结果只有分行陈述的功能不要包含其他信息",project.id)
              if(model){
                webviewViewProvider?.addabilities({project:project?.id,model:model.id,con:result});
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
          const filename = fileName.substring(0,fileName.lastIndexOf('.')) + ".txt";

          const fileType1 = fileName.substring(fileName.lastIndexOf('\\') + 1);
          const filename1 = fileType1.substring(0,fileType1.lastIndexOf('.'));
          let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') ===filename1)));
          let res = "";
          if(project){
            res =  await askAI(content + "请根据上面的代码，生成他们的伪代码。最终的结果只有伪代码不要包含其他信息，伪代码采用自然语言不要使用代码语言！！",project.id)
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
          const filename1 = fileType1.substring(0,fileType1.lastIndexOf('.'));
          let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') ===filename1)));
          let res = "";
          //文件路径
          const filename = fileName.substring(0,fileName.lastIndexOf('.')) + `${fileExtension}`;
          if(project){
            res =  await askAI(content + `上面的内容是你之前帮我生成一个模块中的伪代码，结合整个项目的需求，完成这个模块为一个类注意，你只需要⽣成该模块的代码，不需要考虑其他模块，并请根据上面的伪代码，生成他的${fileExtension}代码。最终的结果只有代码不要包含其他信息，我要把它写入到名字为${filename}的文件中`,project.id)
          }

          try {
            // 创建文件并写入内容
            fs.writeFileSync(filename, ex(res).content);
            console.log(`文件 "${filename}" 已创建并写入内容。`);
            webviewViewProvider?.able()
          } catch (error) {
              console.error(`创建文件 "${fileName}" 时出错: ` + error);
              webviewViewProvider?.able()
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
          const filename1 = fileType1.substring(0,fileType1.lastIndexOf('.'));
          let project = projects.find(project => (project.segments.find(segment => segment.name.replace(/:/g, '-') ===filename1)));
          let res = "";
          //文件路径
          const filename = fileName.substring(0,fileName.lastIndexOf('.')) + `${fileExtension}`;
          if(project){
            res =  await askAI(content + `上面的内容是你之前帮我生成一个模块中的伪代码，我想把他作为主模块，请根据你刚刚⽣成的各个模块的接⼝，为主游戏模块⽣成${fileExtension}代码,并请根据上面的伪代码，生成他的${fileExtension}代码。最终的结果只有代码不要包含其他信息，我要把它写入到名字为${filename}的文件中,注意代码中要包含main函数作为整个项目的入口，然后你只需要⽣成该模块的代码，不需要考虑其他模块。`,project.id)
          }

          try {
            // 创建文件并写入内容
            fs.writeFileSync(filename,  ex(res).content);
            console.log(`文件 "${filename}" 已创建并写入内容。`);
            webviewViewProvider?.able()
          } catch (error) {
              console.error(`创建文件 "${filename}" 时出错: ` + error);
              webviewViewProvider?.able()
          }
        })();
      }),
    )

    interface FileData {
      name: string;
      content: string;
  }
  
}