const PDFDocument = require('pdfkit');

function generateKuendigungPDF(res, data) {
  const {
    subscriptionName,
    anbieterAddress,
    senderName,
    senderAddress,
    kundennummer,
    nextBillingDate,
    today,
  } = data;

  const doc = new PDFDocument({ margin: 60, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kuendigung-${subscriptionName.toLowerCase().replace(/\s+/g, '-')}.pdf"`);
  doc.pipe(res);

  // Sender block (top right)
  doc.font('Helvetica').fontSize(11);
  doc.text(senderName, { align: 'right' });
  if (senderAddress) {
    senderAddress.split('\n').forEach(line => doc.text(line, { align: 'right' }));
  }
  doc.moveDown(2);

  // Recipient
  doc.text(subscriptionName);
  if (anbieterAddress) {
    anbieterAddress.split('\n').forEach(line => doc.text(line));
  }
  doc.moveDown(2);

  // Date
  doc.text(today, { align: 'right' });
  doc.moveDown(2);

  // Subject line
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(`Kündigung meines Abonnements${kundennummer ? ` (Kundennummer: ${kundennummer})` : ''}`);
  doc.moveDown(1.5);

  // Body
  doc.font('Helvetica').fontSize(11);
  doc.text('Sehr geehrte Damen und Herren,');
  doc.moveDown();
  doc.text(
    `hiermit kündige ich mein Abonnement bei ${subscriptionName} fristgerecht und ordentlich zum nächstmöglichen Termin.`,
    { lineGap: 4 }
  );

  if (nextBillingDate) {
    doc.moveDown();
    doc.text(
      `Das nächste Abrechnungsdatum ist der ${nextBillingDate}. Ich bitte um Bestätigung des Kündigungstermins unter Berücksichtigung der vertraglichen Kündigungsfrist.`,
      { lineGap: 4 }
    );
  }

  doc.moveDown();
  doc.text(
    'Bitte bestätigen Sie mir die Kündigung schriftlich.',
    { lineGap: 4 }
  );

  doc.moveDown();
  doc.text(
    'Zusätzlich beantrage ich gemäß Artikel 17 der Datenschutz-Grundverordnung (DSGVO) die unverzügliche Löschung aller meiner gespeicherten personenbezogenen Daten.',
    { lineGap: 4 }
  );

  doc.moveDown(2);
  doc.text('Mit freundlichen Grüßen,');
  doc.moveDown(2);
  doc.text(senderName);

  doc.end();
}

module.exports = { generateKuendigungPDF };
