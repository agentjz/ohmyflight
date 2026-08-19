document.addEventListener("DOMContentLoaded", () => {
  const downloadLink = document.querySelector<HTMLAnchorElement>('a[download$=".zip"]');
  const commandBlock = document.querySelector<HTMLElement>("pre");

  downloadLink?.addEventListener("click", () => {
    const originalText = downloadLink.textContent || "下载独立应用";
    downloadLink.textContent = "已触发下载";
    window.setTimeout(() => {
      downloadLink.textContent = originalText;
    }, 1500);
  });

  commandBlock?.addEventListener("click", async () => {
    const command = commandBlock.innerText.trim();
    if (!command) return;
    commandBlock.title = "已复制";
    await navigator.clipboard.writeText(command).catch(() => undefined);
  });
});
