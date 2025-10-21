// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

admin.initializeApp();
const db = admin.firestore();

// CONFIG - set via firebase functions:config:set (see README below)
const gmailEmail = functions.config().gmail?.email;
const gmailPass = functions.config().gmail?.pass;
const twilioSid = functions.config().twilio?.sid;
const twilioToken = functions.config().twilio?.token;
const twilioPhone = functions.config().twilio?.phone;

if (!gmailEmail || !gmailPass) {
  console.warn("Gmail config missing (functions.config().gmail). Email reminders will fail until configured.");
}
if (!twilioSid || !twilioToken || !twilioPhone) {
  console.warn("Twilio config missing (functions.config().twilio). SMS reminders will fail until configured.");
}

let transporter = null;
if (gmailEmail && gmailPass) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailEmail, pass: gmailPass }
  });
}

const twilioClient = (twilioSid && twilioToken) ? twilio(twilioSid, twilioToken) : null;

async function sendEmail(to, subject, text) {
  if (!transporter) throw new Error("Email transporter not configured");
  const mailOptions = { from: `"SmartToDo" <${gmailEmail}>`, to, subject, text };
  return transporter.sendMail(mailOptions);
}

async function sendSms(to, body) {
  if (!twilioClient) throw new Error("Twilio not configured");
  return twilioClient.messages.create({ body, from: twilioPhone, to });
}

/**
 * Accepts an array of task objects with fields:
 *  - id
 *  - uid
 *  - task
 *  - description
 *  - deadline (ISO string)
 *  - reminderSent (bool)
 *  - contact (email or phone)
 *  - authMethod ("email" | "phone")
 */
async function processTasks(taskDocs) {
  for (const t of taskDocs) {
    try {
      if (t.reminderSent) continue;
      const deadline = new Date(t.deadline);
      const now = new Date();
      const diff = deadline - now;
      if (diff < 0) continue; // past due

      // Only send if within next 24 hours
      if (diff <= 24*60*60*1000) {
        let userRecord = null;
        try {
          userRecord = await admin.auth().getUser(t.uid);
        } catch (e) {
          // can still use t.contact if present
          console.warn("Could not fetch user for uid", t.uid);
        }

        // PHONE USERS -> SMS
        if (t.authMethod === 'phone' && t.contact) {
          const to = t.contact;
          const body = `Reminder: "${t.task}" is due on ${deadline.toLocaleString()}. ${t.description || ''}`;
          if (twilioClient) {
            await sendSms(to, body);
            console.log(`SMS sent to ${to}`);
          } else {
            console.warn("Twilio not configured; cannot send SMS");
          }
        } else {
          // EMAIL: only send if user's email is verified
          const emailTo = (userRecord && userRecord.email) ? userRecord.email : t.contact;
          const isVerified = userRecord ? userRecord.emailVerified : (t.emailVerified || false);
          if (emailTo && isVerified) {
            const subject = `Reminder: Task "${t.task}" is due soon`;
            const text = `Your task "${t.task}" is due on ${deadline.toLocaleString()}.\n\nDescription: ${t.description || 'No description'}`;
            if (transporter) {
              await sendEmail(emailTo, subject, text);
              console.log(`Email sent to ${emailTo}`);
            } else {
              console.warn("Email transporter not configured; cannot send email");
            }
          } else {
            console.warn(`Not sending email for task ${t.id} — no verified email available`);
          }
        }

        // mark reminder as sent
        await db.collection("tasks").doc(t.id).update({ reminderSent: true });
      }
    } catch (err) {
      console.error("Error processing task", t.id, err);
    }
  }
}

// Scheduled function — runs every hour and checks tasks due within 24h
exports.sendTaskReminders = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  const now = new Date();
  const next24 = new Date(now.getTime() + 24*60*60*1000);

  // Get tasks where reminderSent == false
  const snapshot = await db.collection("tasks").where("reminderSent", "==", false).get();
  const tasksToCheck = [];
  snapshot.forEach(snap => {
    const d = snap.data();
    const dl = new Date(d.deadline);
    if (dl >= now && dl <= next24) {
      tasksToCheck.push({ id: snap.id, ...d });
    }
  });

  await processTasks(tasksToCheck);
  return null;
});

// Callable function — check a single task immediately (used after add/edit)
exports.sendImmediateReminder = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'must be signed in');
  const taskId = data.taskId;
  if (!taskId) throw new functions.https.HttpsError('invalid-argument', 'taskId required');

  const docRef = await db.collection("tasks").doc(taskId).get();
  if (!docRef.exists) throw new functions.https.HttpsError('not-found', 'task not found');

  const d = docRef.data();
  await processTasks([{ id: docRef.id, ...d }]);
  return { success: true };
});
