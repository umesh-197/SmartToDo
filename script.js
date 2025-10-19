// script.js (module) - Must be loaded with <script type="module">

// --- Firebase modular imports (v9+/v11 style served from gstatic) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --------- REPLACE with your Firebase project's config ----------
const firebaseConfig = {
  apiKey: "AIzaSyCdda9CT4-7gkwSKAreuu7kgtFyYaFSx5U",
  authDomain: "todolistweb-2433c.firebaseapp.com",
  projectId: "todolistweb-2433c",
  storageBucket: "todolistweb-2433c.firebasestorage.app",
  messagingSenderId: "499814052421",
  appId: "1:499814052421:web:fb0ad1f7676927b6aea92c",
  measurementId: "G-10Z45CV842"
};
// ---------------------------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UI elements
const authContainer = document.getElementById("auth-container");
const todoContainer = document.getElementById("todo-container");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const taskInput = document.getElementById("task-input");
const taskDeadline = document.getElementById("task-deadline");
const addTaskBtn = document.getElementById("add-task-btn");
const taskDesc = document.getElementById("task-desc");
const taskList = document.getElementById("task-list");
const authMsg = document.getElementById("auth-msg");

// ---- Signup ----
signupBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "";
  } catch (err) {
    authMsg.textContent = "Sign up error: " + err.message;
  }
});

// ---- Login ----
loginBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing in...";
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "";
  } catch (err) {
    authMsg.textContent = "Sign in error: " + err.message;
  }
});

// ---- Logout ----
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// ---- Auth state listener ----
onAuthStateChanged(auth, (user) => {
  if (user) {
    // user signed in
    authContainer.style.display = "none";
    todoContainer.style.display = "block";
    loadTasks(user.uid);
    // ask notification permission (optional)
    if (Notification.permission !== "granted") Notification.requestPermission();
  } else {
    authContainer.style.display = "block";
    todoContainer.style.display = "none";
    taskList.innerHTML = "";
  }
});

// ---- Add Task ----
addTaskBtn.addEventListener("click", async () => {
  const title = taskInput.value.trim();
  const desc = taskDesc.value.trim();
  const date = taskDeadline.value;
if (!title || !date) return alert("Title and date required");
  if (!auth.currentUser) return alert("Not signed in");
  try {
    await addDoc(collection(db, "tasks"), {
      uid: auth.currentUser.uid,
      task: title,
      deadline:date,
      deadline: date,
      createdAt: serverTimestamp()
    });
    taskInput.value = "";
    taskDeadline.value = "";
    taskDeadline.value="";
  } catch (err) {
    alert("Add task error: " + err.message);
  }
});

// ---- Load Tasks (real-time) ----
function loadTasks(uid) {
  taskList.innerHTML = "";
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
  <strong>${d.task}</strong> (Deadline: ${d.deadline})<br>
  <em>${d.description ? d.description : "No description"}</em>`;
      taskList.appendChild(li);

      // optional foreground reminder
      if (d.deadline) {
        const deadlineDate = new Date(d.deadline + "T00:00:00");
        const now = new Date();
        const diff = (deadlineDate - now)/(1000*60*60*24);
        if (diff <= 1 && diff >= 0) {
          if (Notification.permission === "granted") {
            new Notification("Reminder: " + d.task, { body: `Due ${d.deadline}` });
          } else {
            // fallback popup
            console.log("Reminder (user not granted notifications):", d.task);
          }
        }
      }
    });
  }, (err) => {
    console.error("onSnapshot error", err);
  });
}

