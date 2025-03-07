import prettyBytes from "pretty-bytes";
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
  Markdown,
} from "@kksh/api/ui/template";

class ExtensionTemplate extends TemplateUiCommand {
  processes: Awaited<ReturnType<typeof sysInfo.processes>> = [];
  lockRefresh = false;
  async onFormSubmit(value: Record<string, any>): Promise<void> {
    toast.success(`Form submitted: ${JSON.stringify(value)}`);
  }

  onHighlightedListItemChanged(value: string): Promise<void> {
    super.onHighlightedListItemChanged(value);
    // console.log("Highlighted list item changed:", value);
    if (!this.highlightedListItemValue) {
      return toast.warning("No process selected");
    }
    const { pid, name } = JSON.parse(this.highlightedListItemValue);
    const process = this.processes.find((p) => p.pid === pid);
    if (!process) {
      return toast.warning("Process not found");
    }
    return Promise.resolve();
  }

  async reload() {
    if (!this.lockRefresh) {
      sysInfo
        .refreshProcesses()
        .then(() => sysInfo.processes())
        .then((processes) => {
          this.processes = processes;
          this.processes.sort(
            (a, b) => (b.cpu_usage ?? 0) - (a.cpu_usage ?? 0)
          );
          // console.log(this.processes);
          ui.setSearchBarPlaceholder("Search by process name or pid");
          ui.render(
            new List.List({
              items: this.processes.map((p) => {
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
                  accessories: [
                    new List.ItemAccessory({
                      text: `CPU: ${(p.cpu_usage ?? 0).toFixed(2)}%`,
                    }),
                    new List.ItemAccessory({
                      text: `${prettyBytes(p.memory ?? 0)}`,
                    }),
                  ],
                });
              }),
              defaultAction: "Toggle Refresh",
            })
          );
        })
        .catch((err) => {
          toast.error(err.message);
        });
    }
    setTimeout(() => {
      this.reload();
    }, 5_000);
  }

  async load() {
    ui.render(new List.List({ items: [] }));
    this.reload();
  }

  async onActionSelected(actionValue: string): Promise<void> {
    if (!this.highlightedListItemValue) {
      return toast.warning("No process selected");
    }
    const { pid, name } = JSON.parse(this.highlightedListItemValue);
    const process = this.processes.find((p) => p.pid === pid);
    switch (actionValue) {
      case "kill":
        console.log("Killing process:", pid);
        shell.killPid(pid);
        this.lockRefresh = false; // need to refresh after killing
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

  async onListItemSelected(value: string): Promise<void> {
    this.lockRefresh = !this.lockRefresh; // toggle refresh
    if (this.lockRefresh) {
      // this.onHighlightedListItemChanged(value);
      const { pid, name } = JSON.parse(value);
      const process = this.processes.find((p) => p.pid === pid);
      if (!process) {
        return toast.warning("Process not found");
      }
      console.log("ListItem selected:", value);
      ui.render(
        new List.List({
          inherits: ["items"],
          detail: new List.ItemDetail({
            children: [
              new List.ItemDetailMetadata([
                new List.ItemDetailMetadataLabel({
                  title: "Name",
                  text: name,
                }),
                new List.ItemDetailMetadataLabel({
                  title: "PID",
                  text: pid.toString(),
                }),
                new List.ItemDetailMetadataLabel({
                  title: "CPU Usage",
                  text: `${(process.cpu_usage ?? 0).toFixed(2)}%`,
                }),
                new List.ItemDetailMetadataLabel({
                  title: "Memory Usage",
                  text: prettyBytes(process.memory ?? 0),
                }),
                new List.ItemDetailMetadataLabel({
                  title: "Parent",
                  text: process.parent?.toString() ?? "Unknown",
                }),
                new List.ItemDetailMetadataLabel({
                  title: "Group",
                  text: process.group_id?.toString() ?? "Unknown",
                }),
              ]),
              new Markdown(`
- **exe:** ${process.exe}
- **Virtual Memory:** ${prettyBytes(process.virtual_memory ?? 0)}
`),
            ],
            width: 30,
          }),
        })
      );
    }
  }
}

expose(new ExtensionTemplate());
