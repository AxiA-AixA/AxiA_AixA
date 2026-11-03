/**
 * AxiA waitlist: receives sign-ups from docs/index.html, adds a row to the "AxiA Waitlist" Google Sheet
 * and emails the team.
 *
 * Setup (once):
 * 1. Open the "AxiA Waitlist" sheet → Extensions → Apps Script. Replace everything there with this file. Save.
 * 2. Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
 *    Allow the permissions Google asks for (edit this sheet, send email as you).
 * 3. Copy the Web app URL (ends in /exec) into WAITLIST_ENDPOINT in docs/index.html.
 * After editing this script later: Deploy → Manage deployments → edit → Version: New version, so the URL stays the same.
 */

const NOTIFY_TO = "qoon@boogpunt.com";
const NOTIFY_CC = "dkel96@gmail.com"; // leave "" for no copy
const SHEET_NAME = "Waitlist";

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (data.website) return reply({ ok: true }); // honeypot: bots fill the hidden field

    const email = String(data.email || "").trim().slice(0, 200);
    const name = String(data.name || "").trim().slice(0, 200);
    const page = String(data.page || "").slice(0, 300);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ ok: false, error: "Enter an email address like you@studio.com." });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      sheet.appendRow([new Date(), safe(name), safe(email), safe(page)]);
    } finally {
      lock.releaseLock();
    }

    const options = { name: "AxiA waitlist" };
    if (NOTIFY_CC) options.cc = NOTIFY_CC;
    MailApp.sendEmail(NOTIFY_TO, "New AxiA waitlist sign-up: " + (name || email),
      "Name: " + (name || "(not given)") + "\nEmail: " + email + "\nPage: " + page +
      "\n\nAll sign-ups: " + SpreadsheetApp.getActiveSpreadsheet().getUrl(), options);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: "That didn’t go through. Please try again." });
  }
}

// Stops a value like "=HYPERLINK(...)" from running as a formula in the sheet.
function safe(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
