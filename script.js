// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyCdda9CT4-7gkwSKAreuu7kgtFyYaFSx5U",
  authDomain: "todolistweb-2433c.firebaseapp.com",
  projectId: "todolistweb-2433c",
  storageBucket: "todolistweb-2433c.firebasestorage.app",
  messagingSenderId: "499814052421",
  appId: "1:499814052421:web:fb0ad1f7676927b6aea92c",
  measurementId: "G-10Z45CV842"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// --- UI elements ---
const authContainer = document.getElementById("auth-container");
const todoContainer = document.getElementById("todo-container");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const taskInput = document.getElementById("task-input");
const taskDesc = document.getElementById("task-desc");
const taskDeadline = document.getElementById("task-deadline");
const addTaskBtn = document.getElementById("add-task-btn");
const taskList = document.getElementById("task-list");
const authMsg = document.getElementById("auth-msg");

// --- Auth ---
signupBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "";
  } catch (err) { authMsg.textContent = "Sign up error: " + err.message; }
});

loginBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing in...";
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "";
  } catch (err) { authMsg.textContent = "Sign in error: " + err.message; }
});

logoutBtn.addEventListener("click", async () => { await signOut(auth); });

onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = "none";
    todoContainer.style.display = "block";
    loadTasks(user.uid);
    if (Notification.permission !== "granted") Notification.requestPermission();
  } else {
    authContainer.style.display = "block";
    todoContainer.style.display = "none";
    taskList.innerHTML = "";
  }
});

// --- Add Task ---
addTaskBtn.addEventListener("click", async () => {
  const title = taskInput.value.trim();
  const desc = taskDesc.value.trim();
  const date = taskDeadline.value;
  if (!title || !date) return alert("Title and date required");
  if (!auth.currentUser) return alert("Not signed in");

  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      uid: auth.currentUser.uid,
      task: title,
      description: desc,
      deadline: date,
      createdAt: serverTimestamp(),
      reminderSent: false
    });
    taskInput.value = "";
    taskDesc.value = "";
    taskDeadline.value = "";

    // --- Trigger immediate email reminder ---
    const sendImmediateReminder = httpsCallable(functions, 'sendImmediateReminder');
    sendImmediateReminder({ taskId: docRef.id }).catch(console.error);
  } catch (err) { alert("Add task error: " + err.message); }
});

// --- Load Tasks (real-time) ---
function loadTasks(uid) {
  taskList.innerHTML = "";
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(q, async (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      d.id = docSnap.id;
      const li = document.createElement("li");
      li.className = "task-item";
      li.innerHTML = `
        <div>
          <strong>${d.task}</strong> (Deadline: ${d.deadline})<br>
          <em>${d.description ? d.description : "No description"}</em>
        </div>
        <div class="btn-group">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>
      `;

      // DELETE TASK
      li.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Delete this task?")) await deleteDoc(doc(db, "tasks", d.id));
      });

      // EDIT TASK
      li.querySelector(".edit-btn").addEventListener("click", async () => {
        const newTitle = prompt("Update task title:", d.task);
        const newDesc = prompt("Update description:", d.description);
        const newDate = prompt("Update deadline (YYYY-MM-DD):", d.deadline);

        if (newTitle && newDate) {
          await updateDoc(doc(db, "tasks", d.id), {
            task: newTitle,
            description: newDesc,
            deadline: newDate,
            reminderSent: false,
            updatedAt: serverTimestamp()
          });

          // Trigger immediate reminder
          const sendImmediateReminder = httpsCallable(functions, 'sendImmediateReminder');
          sendImmediateReminder({ taskId: d.id }).catch(console.error);
        }
      });

      taskList.appendChild(li);

      // Browser notification
      if (d.deadline) {
        const deadlineDate = new Date(d.deadline + "T00:00:00");
        const now = new Date();
        const diff = (deadlineDate - now)/(1000*60*60*24);
        if (diff <= 1 && diff >= 0 && Notification.permission === "granted") {
          new Notification("Reminder: " + d.task, { body: `Due ${d.deadline}` });
        }
      }
    });
  });
}
