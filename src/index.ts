import {
  Action,
  expose,
  List,
  shell,
  TemplateUiCommand,
  sysInfo,
  toast,
  ui,
  clipboard,
} from "@kksh/api/ui/template";

class ExtensionTemplate extends TemplateUiCommand {
  processes: Awaited<ReturnType<typeof sysInfo.processes>> = [];
  async onFormSubmit(value: Record<string, any>): Promise<void> {
    toast.success(`Form submitted: ${JSON.stringify(value)}`);
  }
  async load() {
    ui.render(new List.List({ items: [] }));
    sysInfo
      .refreshProcesses()
      .then(() => sysInfo.processes())
      .then((processes) => {
        this.processes = processes;
        processes.sort((a, b) => (b.cpu_usage ?? 0) - (a.cpu_usage ?? 0));
        console.log(processes);
        ui.render(
          new List.List({
            items: processes.map((p) => {
              //   const exe = p.exe ?? "Unknown Executable";
              //   const trimmedExe = exe.length > 50 ? "..." + exe.slice(-47) : exe;
              return new List.Item({
                title: p.name,
                subTitle: `pid: ${p.pid}`,
                // subTitle: `${trimmedExe} (${p.pid})`,
                value: JSON.stringify({
                  pid: p.pid,
                  name: p.name,
                }),
                actions: new Action.ActionPanel({
                  items: [
                    new Action.Action({
                      title: "Kill",
                      value: "kill",
                    }),
                    new Action.Action({
                      title: "Copy Executable",
                      value: "copy-exe",
                    }),
                    new Action.Action({
                      title: "Copy PID",
                      value: "copy-pid",
                    }),
                  ],
                }),
              });
            }),
          })
        );
      })
      .catch((err) => {
        toast.error(err.message);
      });
  }

  async onActionSelected(actionValue: string): Promise<void> {
    if (!this.highlightedListItemValue) {
      return toast.warning("No process selected");
    }
    const { pid, name } = JSON.parse(this.highlightedListItemValue);
    const process = this.processes.find((p) => p.pid === pid);
    switch (actionValue) {
      case "kill":
        shell.killPid(pid);
        break;
      case "copy-exe":
        if (!process?.exe) {
          return toast.warning("No executable found for this process");
        }
        clipboard.writeText(process.exe);
        break;
      case "copy-pid":
        clipboard.writeText(pid.toString());
        break;
      default:
        break;
    }
  }
}

expose(new ExtensionTemplate());
