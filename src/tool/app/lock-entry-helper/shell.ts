document.addEventListener("DOMContentLoaded", () => {
  const downloadLinks = document.querySelectorAll<HTMLAnchorElement>('a[download]');

  downloadLinks.forEach((downloadLink) => {
    downloadLink.addEventListener("click", () => {
      const originalText = downloadLink.textContent || "下载";
      downloadLink.textContent = "已触发下载";
      window.setTimeout(() => {
        downloadLink.textContent = originalText;
      }, 1500);
    });
  });
});
