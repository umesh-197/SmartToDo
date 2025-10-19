const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: "YOUR_EMAIL@gmail.com", pass: "YOUR_APP_PASSWORD" }
});

// --- Scheduled reminder ---
exports.sendTaskReminders = functions.pubsub.schedule('every 60 minutes').onRun(async () => {
  await sendReminders();
});

// --- Immediate reminder (callable) ---
exports.sendImmediateReminder = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  const taskDoc = await db.collection("tasks").doc(data.taskId).get();
  if (!taskDoc.exists) throw new functions.https.HttpsError('not-found', 'Task not found');
  await sendReminders([taskDoc]);
  return { success: true };
});

// --- Send reminders function ---
async function sendReminders(taskDocs) {
  const now = new Date();
  let tasksToCheck = [];

  if (taskDocs && taskDocs.length > 0) {
    tasksToCheck = taskDocs.map(doc => ({ id: doc.id, ...doc.data(), ref: doc.ref }));
  } else {
    const next24h = new Date(now.getTime() + 24*60*60*1000);
    const snapshot = await db.collection("tasks")
      .where("deadline", ">=", now.toISOString().split('T')[0])
      .where("deadline", "<=", next24h.toISOString().split('T')[0])
      .get();
    snapshot.forEach(docSnap => tasksToCheck.push({ id: docSnap.id, ...docSnap.data(), ref: docSnap.ref }));
  }

  for (const task of tasksToCheck) {
    if (!task.reminderSent) {
      const userRecord = await admin.auth().getUser(task.uid);
      const mailOptions = {
        from: '"Smart ToDo" <YOUR_EMAIL@gmail.com>',
        to: userRecord.email,
        subject: `Reminder: Task "${task.task}" is due soon`,
        text: `Your task "${task.task}" is due on ${task.deadline}.\nDescription: ${task.description || 'No description'}`
      };
      await transporter.sendMail(mailOptions);
      await task.ref.update({ reminderSent: true });
    }
  }
}
