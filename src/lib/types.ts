export type Locale = "zh" | "en";
export type PageId =
  | "home"
  | "orders"
  | "sql"
  | "images"
  | "convert"
  | "markdown"
  | "remote"
  | "database"
  | "chat"
  | "dashboard"
  | "snippets"
  | "settings"
  | "history";
export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  type: "ssh" | "rdp";
  group: string;
  auth?: "password" | "key";
}
export interface ChatAttachment {
  id: string;
  name: string;
  kind: "image" | "text";
  mime: string;
  size: number;
}
export interface KnowledgeSource {
  id: string;
  title: string;
  content: string;
}
export interface ChatMessage {
  attachments?: ChatAttachment[];
  knowledge?: KnowledgeSource[];
  role: "user" | "assistant";
  content: string;
}
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}
export interface Snippet {
  id: string;
  title: string;
  content: string;
}
export interface AppState {
  version: 1;
  locale: Locale;
  theme: "light" | "dark";
  favorites: PageId[];
  recent: { page: PageId; at: number }[];
  usage: Record<string, number>;
  order: {
    input: string;
    size: number;
    delimiter: string;
    dedupe: boolean;
    quote: string;
    split: string;
    mode: "size" | "groups";
  };
  sql: {
    template: string;
    input: string;
    dedupe: boolean;
    separator: "lines" | "auto";
  };
  markdown: { text: string; name: string; path: string };
  servers: ServerProfile[];
  databases: DatabaseProfile[];
  chats: ChatSession[];
  snippets: Snippet[];
  ai: { endpoint: string; model: string; mode: string; system: string };
  dashboard: { csv: string; name: string; x: string; y: string; type: string };
}
export interface FileEntry {
  filename: string;
  directory: boolean;
  size: number;
  modified: number;
}
export interface DesktopBridge {
  flush(state: unknown): boolean;
  invoke(channel: string, payload?: unknown): Promise<any>;
  on(channel: string, listener: (payload: any) => void): () => void;
}
declare global {
  interface Window {
    litebox?: DesktopBridge;
  }
}

export interface DatabaseProfile {
  id: string;
  name: string;
  type: "mysql" | "postgres" | "sqlite" | "oracle" | "mongodb" | "redis";
  host: string;
  port: number;
  username: string;
  database: string;
  path: string;
  tls: boolean;
  authSource?: string;
}
export interface QueryResult {
  columns: string[];
  rows: (string | null)[][];
  truncated: boolean;
  hasMore?: boolean;
  offset?: number;
  nextOffset?: number;
  elapsedMs: number;
}
