import * as vscode from 'vscode';

import { createwebview } from "./createview/create";
import { registerCreateSetting } from "./setting/setting";
import { ask } from "./openai/keycheck";
import { remake } from './makenew/remake';
import { confirm } from './confirm/confirm';
import { watchTxt } from './watch/watch';
import { addmenuscommand } from './menu/menucommand';


interface Segment {
    id: string;
    name: string;
}

interface Project {
    id: string;
    name: string;
    segments: Segment[];
}

export var projects: Project[] = [];

export async function activate(context: vscode.ExtensionContext) {
    registerCreateSetting(context);
    createwebview(context);
    ask(context);
    remake(context);
    confirm(context);
    watchTxt();
}

export function deactivate() {}
