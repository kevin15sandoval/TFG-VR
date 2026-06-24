// ─── GENERADOR DE INFORMES PDF ────────────────────────────────────────────────
// Genera informe clínico completo de un paciente en PDF

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Patient, SessionRecord } from "./types";

export function generatePatientReport(patient: Patient, sessions: SessionRecord[]): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // ── Colores corporativos ──────────────────────────────────────────────────
  const BLUE   = [29, 78, 216] as [number, number, number];
  const DARK   = [15, 23, 42]  as [number, number, number];
  const GRAY   = [100, 116, 139] as [number, number, number];
  const LIGHT  = [241, 245, 249] as [number, number, number];
  const GREEN  = [16, 185, 129]  as [number, number, number];
  const RED    = [239, 68, 68]   as [number, number, number];
  const AMBER  = [245, 158, 11]  as [number, number, number];

  // ── Calcular métricas ────────────────────────────────────────────────────
  const total      = sessions.length;
  const bestScore  = total ? Math.max(...sessions.map(s => s.score)) : 0;
  const avgAcc     = total ? Math.round(sessions.reduce((a, s) => a + s.accuracy, 0) / total) : 0;
  const totalMins  = sessions.reduce((a, s) => a + s.duration, 0);
  const lastDate   = sessions[0]?.date ?? "—";

  // ── CABECERA ─────────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("NeuroVR Rehab", margin, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Plataforma clínica de rehabilitación VR", margin, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informe clínico del paciente", margin, 30);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, pageW - margin - 50, 30);

  y = 46;

  // ── FICHA DEL PACIENTE ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, pageW - margin * 2, 42, 3, 3, "F");

  doc.setTextColor(...DARK);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(patient.name, margin + 4, y + 9);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(patient.diagnosis, margin + 4, y + 16);

  const badges = [
    `${patient.age} años`,
    `Lado afectado: ${patient.affectedSide}`,
    `Estado: ${patient.status}`,
  ];
  badges.forEach((b, i) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 4 + i * 48, y + 20, 44, 7, 2, 2, "F");
    doc.setTextColor(...DARK);
    doc.setFontSize(7.5);
    doc.text(b, margin + 4 + i * 48 + 2, y + 25);
  });

  // Notas clínicas
  if (patient.notes) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`Notas: ${patient.notes}`, margin + 4, y + 36);
  }

  y += 50;

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Sesiones realizadas", value: String(total) },
    { label: "Mejor puntuación", value: bestScore.toLocaleString() },
    { label: "Precisión media", value: `${avgAcc}%` },
    { label: "Tiempo total", value: `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` },
    { label: "Última sesión", value: lastDate },
    { label: "Progreso global", value: `${patient.progress}%` },
  ];

  const kpiW = (pageW - margin * 2 - 10) / 3;
  kpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * (kpiW + 5);
    const ky = y + row * 20;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, ky, kpiW, 17, 2, 2, "FD");

    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label.toUpperCase(), x + 3, ky + 6);

    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 3, ky + 13);
  });

  y += 46;

  // ── PROGRESO (barra) ──────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Progreso de rehabilitación", margin, y + 5);

  doc.setFillColor(226, 232, 240);
  doc.roundedRect(margin, y + 8, pageW - margin * 2, 6, 3, 3, "F");

  const progressColor: [number, number, number] =
    patient.progress >= 70 ? GREEN : patient.progress >= 40 ? AMBER : RED;
  const barW = ((pageW - margin * 2) * patient.progress) / 100;
  doc.setFillColor(...progressColor);
  doc.roundedRect(margin, y + 8, barW, 6, 3, 3, "F");

  doc.setFontSize(8);
  doc.setTextColor(...progressColor);
  doc.text(`${patient.progress}%`, pageW - margin - 8, y + 13);

  y += 22;

  // ── TABLA DE SESIONES ─────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(`Historial de sesiones (${total})`, margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Fecha", "Ejercicio", "Duración", "Lado", "Dificultad", "Puntuación", "Precisión"]],
    body: sessions.map(s => [
      s.date,
      s.game,
      `${s.duration} min`,
      s.side,
      s.difficulty,
      s.score.toLocaleString(),
      `${s.accuracy}%`,
    ]),
    headStyles: {
      fillColor: BLUE,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 38 },
      2: { cellWidth: 18 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 18, halign: "center" },
    },
    didDrawCell: (data) => {
      // Colorear precisión
      if (data.section === "body" && data.column.index === 6) {
        const val = parseInt(String(data.cell.raw));
        if (!isNaN(val)) {
          const color = val >= 80 ? GREEN : val >= 65 ? AMBER : RED;
          doc.setTextColor(...color);
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.text(`${val}%`, data.cell.x + data.cell.width / 2, data.cell.y + 5, { align: "center" });
        }
      }
    },
  });

  // ── NOTAS POR SESIÓN ─────────────────────────────────────────────────────
  const withNotes = sessions.filter(s => s.notes && s.notes.trim());
  if (withNotes.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Notas clínicas por sesión", margin, finalY);

    let ny = finalY + 6;
    withNotes.forEach(s => {
      if (ny > 270) { doc.addPage(); ny = margin; }
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(margin, ny, pageW - margin * 2, 10, 2, 2, "FD");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(`${s.date} · ${s.game}`, margin + 3, ny + 4.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(s.notes ?? "", margin + 3, ny + 8.5);
      ny += 13;
    });
  }

  // ── PIE DE PÁGINA ────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `NeuroVR Rehab · Informe clínico confidencial · Página ${i} de ${pages}`,
      pageW / 2,
      293,
      { align: "center" }
    );
  }

  // ── DESCARGAR ─────────────────────────────────────────────────────────────
  const fileName = `informe_${patient.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
