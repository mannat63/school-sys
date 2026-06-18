const BRAND_COLOR = [30, 41, 59]; // slate-800

let _jsPDF = null;
let _autoTable = null;

async function loadJsPDF() {
  if (_jsPDF) return _jsPDF;
  const mod = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  _jsPDF = mod.default;
  _autoTable = autoTableMod.default;
  return _jsPDF;
}

export async function createPdf({ title, subtitle, landscape = false }) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Intellogy Coaching", 14, 12);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 210);
  doc.text("Academic Excellence", 14, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageW - 14, 12, { align: "right" });

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 210);
    doc.text(subtitle, pageW - 14, 18, { align: "right" });
  }

  doc.setFontSize(7);
  doc.setTextColor(180, 180, 190);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, pageW - 14, 24, { align: "right" });

  doc.setTextColor(0, 0, 0);

  const addFooter = () => {
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Intellogy Coaching — Confidential`, 14, pageH - 8);
      doc.text(`Page ${i} of ${totalPages}`, pageW - 14, pageH - 8, { align: "right" });
    }
  };

  return { doc, pageW, pageH, startY: 34, addFooter };
}

export function addTable(doc, { startY, head, body, theme = "striped", styles = {} }) {
  _autoTable(doc, {
    startY,
    head: [head],
    body,
    theme,
    headStyles: { fillColor: BRAND_COLOR, fontSize: 8, fontStyle: "bold", halign: "left" },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    ...styles,
  });
  return doc.lastAutoTable.finalY;
}

export function addSectionTitle(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(text, 14, y);
  return y + 6;
}

export function downloadPdf(doc, filename, addFooter) {
  if (addFooter) addFooter();
  doc.save(filename);
}
