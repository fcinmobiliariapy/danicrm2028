import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AgendaEvent, CustomField, PersonRecord, SystemSettings } from '../types';
import { formatDisplayDate, formatNumber } from './api';

export interface ExportColumn {
  key: string;
  label: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [30, 58, 138];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [isNaN(r) ? 30 : r, isNaN(g) ? 58 : g, isNaN(b) ? 138 : b];
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function exportTableToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
) {
  const mapped = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      out[col.label] = row[col.key] ?? '';
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportTableToPDF(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  settings: SystemSettings;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  summaryLines?: string[];
  orientation?: 'portrait' | 'landscape';
}) {
  const { filename, title, subtitle, settings, columns, rows, summaryLines = [], orientation } = opts;
  const format = settings.document_format === 'LETTER' ? 'letter' : 'a4';
  const orient = orientation || (columns.length > 6 ? 'landscape' : 'portrait');
  const doc = new jsPDF({ orientation: orient, unit: 'mm', format });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryRgb = hexToRgb(settings.primary_color || '#1E3A8A');
  const logoData = await loadImageDataUrl(settings.logo_url);
  const generatedLabel = `Generado: ${formatDisplayDate(new Date().toISOString().slice(0, 10), settings.date_format)} ${new Date().toTimeString().slice(0, 5)}`;

  const drawChrome = (pageNum: number, totalPages: number) => {
    // Header band
    doc.setFillColor(...primaryRgb);
    doc.rect(0, 0, pageWidth, 24, 'F');
    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', 10, 3, 18, 18);
      } catch {
        // ignore invalid image format
      }
    }
    const textX = logoData ? 32 : 12;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.organization_name || settings.platform_name, textX, 9);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.header_text || settings.campaign_reference, textX, 15);
    doc.text(generatedLabel, pageWidth - 12, 15, { align: 'right' });

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text(settings.footer_text || '', 12, pageHeight - 7);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 12, pageHeight - 7, { align: 'right' });
  };

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 12, 33);
  let startY = 39;
  if (subtitle) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 12, 39);
    startY = 45;
  }

  autoTable(doc, {
    startY,
    margin: { top: 28, bottom: 18, left: 12, right: 12 },
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: primaryRgb, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  if (summaryLines.length > 0) {
    const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || startY) + 8;
    if (finalY < pageHeight - 25) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      summaryLines.forEach((line, idx) => {
        doc.text(line, 12, finalY + idx * 5);
      });
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawChrome(i, totalPages);
  }

  doc.save(`${filename}.pdf`);
}

export async function exportIndividualFichaPDF(
  moduleLabel: string,
  settings: SystemSettings,
  record: PersonRecord,
  customFields: CustomField[]
) {
  const rows: { campo: string; valor: string }[] = [
    { campo: 'Nombres y Apellidos', valor: `${record.first_name} ${record.last_name}` },
    { campo: 'Cédula de Identidad (C.I.)', valor: record.ci },
    { campo: 'Departamento', valor: record.department_name || String(record.department_id) },
    { campo: 'Distrito', valor: record.district_name || String(record.district_id) },
    { campo: 'Seccional N°', valor: String(record.seccional_number) },
    { campo: 'Teléfono', valor: record.phone },
    { campo: 'Fecha de Registro', valor: formatDisplayDate(record.registered_at, settings.date_format) },
    { campo: 'Observaciones', valor: record.notes || 'Sin observaciones' },
  ];

  for (const cf of customFields) {
    rows.push({
      campo: cf.label,
      valor: String(record.custom_fields?.[cf.field_key] ?? '—'),
    });
  }

  await exportTableToPDF({
    filename: `ficha-${moduleLabel.toLowerCase()}-${record.ci}`,
    title: `Ficha Individual de ${moduleLabel}`,
    subtitle: `${record.first_name} ${record.last_name} · Seccional N° ${record.seccional_number}`,
    settings,
    columns: [
      { key: 'campo', label: 'Campo' },
      { key: 'valor', label: 'Información Registrada' },
    ],
    rows,
    orientation: 'portrait',
  });
}

export async function exportAgendaPDF(opts: {
  filename: string;
  title: string;
  rangeLabel: string;
  settings: SystemSettings;
  events: AgendaEvent[];
}) {
  const rows = opts.events.map((e, idx) => ({
    row_num: idx + 1,
    fecha: formatDisplayDate(e.event_date, opts.settings.date_format),
    horario: `${e.start_time} - ${e.end_time}`,
    tipo: e.event_type,
    titulo: e.title,
    ubicacion: [e.department_name, e.district_name, e.seccional_number ? `Secc. ${e.seccional_number}` : '', e.location]
      .filter(Boolean)
      .join(' · '),
    responsable: e.responsible || '—',
  }));

  await exportTableToPDF({
    filename: opts.filename,
    title: opts.title,
    subtitle: opts.rangeLabel,
    settings: opts.settings,
    columns: [
      { key: 'row_num', label: 'N°' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'horario', label: 'Horario' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'titulo', label: 'Actividad' },
      { key: 'ubicacion', label: 'Ubicación / Lugar' },
      { key: 'responsable', label: 'Responsable' },
    ],
    rows,
    summaryLines: [`Total de actividades incluidas: ${formatNumber(rows.length)}`],
    orientation: 'landscape',
  });
}

export async function exportSingleEventPDF(settings: SystemSettings, ev: AgendaEvent) {
  const rows = [
    { campo: 'Título de la Actividad', valor: ev.title },
    { campo: 'Tipo de Actividad', valor: ev.event_type },
    { campo: 'Fecha', valor: formatDisplayDate(ev.event_date, settings.date_format) },
    { campo: 'Horario', valor: `${ev.start_time} a ${ev.end_time}` },
    { campo: 'Territorio', valor: [ev.department_name, ev.district_name, ev.seccional_number ? `Seccional ${ev.seccional_number}` : ''].filter(Boolean).join(' · ') || 'General' },
    { campo: 'Lugar', valor: ev.location || '—' },
    { campo: 'Responsable', valor: ev.responsible || '—' },
    { campo: 'Participantes', valor: ev.participants || '—' },
    { campo: 'Descripción', valor: ev.description || '—' },
    { campo: 'Observaciones', valor: ev.notes || '—' },
    { campo: 'Estado', valor: ev.status.toUpperCase() },
    { campo: 'Asistencia Registrada', valor: String(ev.attendance_count ?? 0) },
    { campo: 'Resumen / Acuerdos', valor: ev.activity_outcomes || ev.activity_summary || '—' },
  ];

  await exportTableToPDF({
    filename: `informe-actividad-${ev.id}`,
    title: 'Informe Individual de Actividad',
    subtitle: `${ev.title} (${formatDisplayDate(ev.event_date, settings.date_format)})`,
    settings,
    columns: [
      { key: 'campo', label: 'Detalle' },
      { key: 'valor', label: 'Contenido' },
    ],
    rows,
    orientation: 'portrait',
  });
}
