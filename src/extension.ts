import * as vscode from 'vscode';

import { createwebview } from "./createview/create";
import { registerCreateSetting } from "./setting/setting";
import { ask } from "./openai/keycheck";
import { remake } from './makenew/remake';
import { confirm } from './confirm/confirm';
import { watchTxt } from './watch/watch';
import { addmenuscommand } from './menu/menucommand';
import { collapse } from './collapse/collapse';
import { save } from './save/save';
import { comment } from './comment/comment';



interface Project {
    id: string;
    name: string;
    segments: Project [];
}

export var projects: Project[] = [];

export async function activate(context: vscode.ExtensionContext) {
    registerCreateSetting(context);
    createwebview(context);
    ask(context);
    remake(context);
    confirm(context);
    collapse(context);
    save(context);
    watchTxt();
    comment(context);
}

export function deactivate() {}
