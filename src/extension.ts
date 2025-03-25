import * as vscode from 'vscode';

import { createwebview } from "./createview/create";
import { registerCreateSetting } from "./setting/setting";
import { ask } from "./openai/keycheck";
import { remake } from './makenew/remake';
import { confirm } from './confirm/confirm';
import { watchTxt } from './watch/watch';
import { collapse } from './collapse/collapse';
import { save } from './save/save';
import { comment } from './comment/comment';
import { startLogging } from './log/log';
// import { addmenuscommand } from './menu/menucommand';

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
    startLogging(context);
    remake(context);
    confirm(context);
    collapse(context);
    save(context);
    watchTxt();
    comment(context);
}

export function deactivate() {}