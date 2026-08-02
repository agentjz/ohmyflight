document.addEventListener("DOMContentLoaded", () => {
  const downloadLinks = document.querySelectorAll<HTMLAnchorElement>("a[download]");
  const commandBlocks = document.querySelectorAll<HTMLElement>("pre");

  downloadLinks.forEach((downloadLink) => {
    downloadLink.addEventListener("click", () => {
      const originalText = downloadLink.textContent || "下载";
      downloadLink.textContent = "已触发下载";
      window.setTimeout(() => {
        downloadLink.textContent = originalText;
      }, 1500);
    });
  });

  commandBlocks.forEach((block) => {
    block.style.cursor = "pointer";
    block.title = "点击复制命令";
    block.addEventListener("click", async () => {
      const command = block.innerText.trim();
      if (!command) return;

      try {
        await navigator.clipboard.writeText(command);
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(block);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("copy");
        selection?.removeAllRanges();
      }
    });
  });
});
