import { initExtract } from "./extract";
import { initImageToPdf } from "./image-to-pdf";
import { initMerge } from "./merge";
import type { PdfToolDependencies } from "./models";
import { initPdfToImage } from "./pdf-to-image";

document.addEventListener("DOMContentLoaded", () => {
  const browserWindow = window as typeof window & {
    bootstrap: { Modal: PdfToolDependencies["BootstrapModal"] };
    pdfjsLib: PdfToolDependencies["pdfjsLib"];
    PDFLib: { PDFDocument: PdfToolDependencies["PDFDocument"] };
    JSZip: PdfToolDependencies["JSZip"];
  };
  const dependencies = {
    pdfjsLib: browserWindow.pdfjsLib,
    PDFDocument: browserWindow.PDFLib.PDFDocument,
    JSZip: browserWindow.JSZip,
    BootstrapModal: browserWindow.bootstrap.Modal
  } satisfies PdfToolDependencies;
  dependencies.pdfjsLib.GlobalWorkerOptions.workerSrc = "../../../libs/pdf.worker.min.js";

  initExtract(dependencies);
  initMerge(dependencies);
  initPdfToImage(dependencies);
  initImageToPdf(dependencies);
});
