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
const SITE_URL = "https://axia-aixa.github.io/AxiA_AixA/";
// Each sign-up sends two emails (team + confirmation). A personal Gmail account can send to about 100 recipients a day
// (the CC counts too), so roughly 30 sign-ups a day. A Google Workspace account allows far more.

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

    // Confirmation to the person who signed up. If it fails, the sign-up still counts.
    try {
      MailApp.sendEmail(email, "You’re on the AxiA waitlist",
        "Hi" + (name ? " " + name : "") + ",\n\n" +
        "Thanks for joining the AxiA early-access waitlist. Early access opens in small groups, and we’ll email you when it’s your turn.\n\n" +
        "If this wasn’t you, or you’d like us to delete your details, just reply to this email.\n\n" +
        "AxiA · London\n" + SITE_URL + "\nPrivacy: " + SITE_URL + "privacy.html",
        { name: "AxiA", replyTo: NOTIFY_TO });
    } catch (mailErr) {}

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
