
import {createwebview} from "./createview/create";
import {registerCreateSetting} from "./setting/setting"
import {ask} from "./openai/keycheck"
import * as vscode from 'vscode';
import {remake} from './makenew/remake'
import {addmenuscommand} from './menu/menucommand'
// 定义段的接口
interface Segment {
    id: string;
    name: string;
}

// 定义项目的接口
interface Project {
    id: string;
    name: string;
    segments: Segment[]; // segments 可以是一个空数组
}

// 声明 projects 变量为 Project 对象数组
export var projects: Project[] = [];
export async function activate(context: vscode.ExtensionContext) {
    registerCreateSetting(context);
    createwebview(context);
    ask(context);
    remake(context);

}
