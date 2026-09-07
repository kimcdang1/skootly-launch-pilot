export async function readLaunchFile(file: File) {
  if (file.size > 2_000_000) throw new Error("Choose a file under 2 MB.");
  let text = "";
  if (/\.pdf$/i.test(file.name)) {
    const [pdf, worker] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
    ]);
    pdf.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdf.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const document = await task.promise;
    try {
      if (document.numPages > 30)
        throw new Error(
          "Use a PDF of 30 pages or fewer, or paste a focused extract."
        );
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n);
        const content = await page.getTextContent();
        text +=
          content.items.map(item => ("str" in item ? item.str : "")).join(" ") +
          "\n";
        if (text.length > 20000)
          throw new Error(
            "This file is too long. Paste an extract of up to 20,000 characters."
          );
      }
    } finally {
      await task.destroy();
    }
  } else if (/\.(txt|md)$/i.test(file.name)) text = await file.text();
  else throw new Error("Choose a PDF, TXT or Markdown file.");
  if (text.trim().length < 50)
    throw new Error(
      "There isn’t enough readable text. For a scanned PDF, paste the transcript instead."
    );
  if (text.length > 20000)
    throw new Error(
      "Use up to 20,000 characters. Paste a focused extract instead."
    );
  return text.trim();
}
