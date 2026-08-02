import { initBase64 } from "./base64";
import { initCompress } from "./compress";
import { initConvert } from "./convert";
import { initCrop } from "./crop";
import { initResize } from "./resize";

document.addEventListener("DOMContentLoaded", () => {
  initConvert();
  initCompress();
  initResize();
  initCrop();
  initBase64();
});
