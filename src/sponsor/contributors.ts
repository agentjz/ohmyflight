export interface Contributor {
  name: string;
  contribution: string;
  linkUrl: string;
  avatarUrl: string;
}

export const contributors = {
  labels: {
    title: "贡献人员",
    pendingCount: "暂时留空",
    emptyMessage: "暂时留空",
    countTemplate: "{count} 位贡献者"
  },
  people: [
    {
      name: "luckymaomi",
      contribution: "设计 cargodog 架构。",
      linkUrl: "https://github.com/luckymaomi",
      avatarUrl: "https://github.com/luckymaomi.png"
    }
  ] satisfies Contributor[]
};
