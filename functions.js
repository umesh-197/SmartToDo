const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "YOUR_EMAIL@gmail.com",
    pass: "YOUR_APP_PASSWORD"
  }
});

exports.sendTaskReminders = functions.pubsub.schedule('every 60 minutes').onRun(async () => {
  const now = new Date();
  const next24h = new Date(now.getTime() + 24*60*60*1000);

  const tasksSnapshot = await db.collection("tasks")
    .where("deadline", ">=", now.toISOString().split('T')[0])
    .where("deadline", "<=", next24h.toISOString().split('T')[0])
    .get();

  tasksSnapshot.forEach(async docSnap => {
    const task = docSnap.data();
    if (!task.reminderSent) {
      const userRecord = await admin.auth().getUser(task.uid);
      const mailOptions = {
        from: '"Smart ToDo" <YOUR_EMAIL@gmail.com>',
        to: userRecord.email,
        subject: `Reminder: Task "${task.task}" is due soon`,
        text: `Your task "${task.task}" is due on ${task.deadline}.\nDescription: ${task.description || 'No description'}`
      };

      await transporter.sendMail(mailOptions);
      await docSnap.ref.update({ reminderSent: true });
    }
  });

  console.log("Email reminders sent for tasks due within 24h");
});
