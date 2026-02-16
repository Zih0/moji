interface ElectronAPI {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

interface Window {
  electronAPI: ElectronAPI;
}
