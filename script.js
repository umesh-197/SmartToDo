// script.js - Must be loaded as <script type="module">

// --- Firebase imports (modular SDK) ---
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
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---- Your Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyCdda9CT4-7gkwSKAreuu7kgtFyYaFSx5U",
  authDomain: "todolistweb-2433c.firebaseapp.com",
  projectId: "todolistweb-2433c",
  storageBucket: "todolistweb-2433c.firebasestorage.app",
  messagingSenderId: "499814052421",
  appId: "1:499814052421:web:fb0ad1f7676927b6aea92c",
  measurementId: "G-10Z45CV842"
};

// ---- Initialize Firebase ----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- DOM Elements ----
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

// ---- Sign Up ----
signupBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Creating account...";
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

// ---- Auth State Listener ----
onAuthStateChanged(auth, (user) => {
  if (user) {
    authContainer.style.display = "none";
    todoContainer.style.display = "block";
    loadTasks(user.uid);
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

  if (!title || !date) return alert("Please enter both task title and deadline");
  if (!auth.currentUser) return alert("Not signed in");

  try {
    await addDoc(collection(db, "tasks"), {
      uid: auth.currentUser.uid,
      task: title,
      description: desc,
      deadline: date,
      createdAt: serverTimestamp()
    });

    taskInput.value = "";
    taskDesc.value = "";
    taskDeadline.value = "";
  } catch (err) {
    alert("Add task error: " + err.message);
  }
});

// ---- Load Tasks (Real-time) ----
function loadTasks(uid) {
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const li = document.createElement("li");
      li.className = "task-item";
      li.innerHTML = `
        <div>
          <strong>${d.task}</strong> (Deadline: ${d.deadline})<br>
          <em>${d.description || "No description"}</em>
        </div>
        <div class="btn-group">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </div>
      `;

      // ---- Delete Task ----
      li.querySelector(".delete-btn").addEventListener("click", async () => {
        if (confirm("Delete this task?")) {
          await deleteDoc(doc(db, "tasks", docSnap.id));
        }
      });

      // ---- Edit Task ----
      li.querySelector(".edit-btn").addEventListener("click", async () => {
        const newTitle = prompt("Update task title:", d.task);
        const newDesc = prompt("Update description:", d.description);
        const newDate = prompt("Update deadline (YYYY-MM-DD):", d.deadline);

        if (newTitle && newDate) {
          await updateDoc(doc(db, "tasks", docSnap.id), {
            task: newTitle,
            description: newDesc,
            deadline: newDate,
            updatedAt: serverTimestamp()
          });
        }
      });

      taskList.appendChild(li);
    });
  });
}
