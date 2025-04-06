import { commands, ExtensionContext } from "vscode";

export const registerCreateSetting = (context: ExtensionContext) => {
  context.subscriptions.push(
    commands.registerCommand("CodeToolBox.openSetting", () => {
      commands.executeCommand("workbench.action.openSettings", "ChatVS");
    }),
  );
};
