export type AskRequest = {
  userQuestion: string;
  datasetName?: string;
};

export type AskRow = Record<string, string | number | boolean | null>;

export type AskResponse = {
  rows: AskRow[];
  humanResponse: string;
  sql: string;
  table: string;
};

export type AskError = {
  error: string;
};
