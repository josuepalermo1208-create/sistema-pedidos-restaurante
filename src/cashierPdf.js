import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { money, shortTime } from './store'

export function createCashierPdf({ date, cashier, sales, cashTotal, cardTotal }) {
  const document = new jsPDF()
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const total = cashTotal + cardTotal
  const reportDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })
    .format(new Date(`${date}T12:00:00`))
  const generatedAt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date())

  document.setProperties({
    title: `Corte de caja ${date}`,
    subject: 'Corte de caja del cajero',
    author: cashier,
  })
  document.setFillColor(38, 45, 34)
  document.rect(0, 0, pageWidth, 38, 'F')
  document.setTextColor(255, 255, 255)
  document.setFont('helvetica', 'bold')
  document.setFontSize(12)
  document.text('Cadena de Restaurantes SaborMX', 14, 13)
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  document.text('Grupo Restaurantero SaborMX S.A. de C.V.', 14, 19)
  document.setFont('helvetica', 'bold')
  document.setFontSize(16)
  document.text('CORTE DE CAJA', 14, 31)

  document.setTextColor(38, 45, 34)
  document.setFont('helvetica', 'normal')
  document.setFontSize(10)
  document.text(`Cajero: ${cashier}`, 14, 47)
  document.text(`Fecha: ${reportDate}`, pageWidth - 14, 47, { align: 'right' })
  document.setFontSize(8)
  document.setTextColor(100, 105, 96)
  document.text(`Generado: ${generatedAt}`, 14, 53)

  autoTable(document, {
    startY: 59,
    head: [['Resumen', 'Detalle']],
    body: [
      ['Cuentas cobradas', String(sales.length)],
      ['Efectivo', money(cashTotal)],
      ['Tarjeta', money(cardTotal)],
      ['Total cobrado', money(total)],
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [238, 240, 233], textColor: [38, 45, 34] },
    columnStyles: { 0: { cellWidth: 75 }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  const detailStart = document.lastAutoTable.finalY + 10
  document.setTextColor(38, 45, 34)
  document.setFont('helvetica', 'bold')
  document.setFontSize(11)
  document.text('Detalle de ventas', 14, detailStart)
  autoTable(document, {
    startY: detailStart + 4,
    head: [['Hora', 'Mesa', 'Cuenta', 'Método', 'Total']],
    body: sales.map((sale) => [
      shortTime(sale.paidAt),
      sale.tableName,
      sale.id,
      sale.method,
      money(sale.total),
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [38, 45, 34] },
    columnStyles: { 4: { halign: 'right' } },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      document.setTextColor(100, 105, 96)
      document.setFont('helvetica', 'normal')
      document.setFontSize(8)
      document.text(
        `Página ${document.internal.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' },
      )
    },
  })

  return document
}

export function generateCashierPdf(report) {
  const cashierSlug = report.cashier.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  createCashierPdf(report).save(`corte-caja-${report.date}-${cashierSlug || 'cajero'}.pdf`)
}
