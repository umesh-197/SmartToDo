// --- Firebase modular imports ---
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

// --------- Firebase configuration ----------
const firebaseConfig = {
  apiKey: "AIzaSyCdda9CT4-7gkwSKAreuu7kgtFyYaFSx5U",
  authDomain: "todolistweb-2433c.firebaseapp.com",
  projectId: "todolistweb-2433c",
  storageBucket: "todolistweb-2433c.appspot.com",
  messagingSenderId: "499814052421",
  appId: "1:499814052421:web:fb0ad1f7676927b6aea92c",
  measurementId: "G-10Z45CV842"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

// ---- Signup ----
signupBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "Account created successfully!";
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
    authContainer.style.display = "none";
    todoContainer.style.display = "block";
    loadTasks(user.uid);
    startReminderChecker();
  } else {
    authContainer.style.display = "block";
    todoContainer.style.display = "none";
    taskList.innerHTML = "";
  }
});

// ---- Add Task (Instant Display + Firestore Sync) ----
addTaskBtn.addEventListener("click", async () => {
  const title = taskInput.value.trim();
  const desc = taskDesc.value.trim();
  const date = taskDeadline.value;

  if (!title || !date) return alert("Please enter task title and deadline");
  if (!auth.currentUser) return alert("Not signed in");

  // Instant display
  const tempId = "temp-" + Date.now();
  displayTask({
    id: tempId,
    task: title,
    description: desc,
    deadline: date
  });

  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      uid: auth.currentUser.uid,
      task: title,
      description: desc,
      deadline: date,
      createdAt: serverTimestamp()
    });

    // Replace temp ID with real Firestore ID
    const tempItem = document.getElementById(tempId);
    if (tempItem) tempItem.id = docRef.id;
  } catch (err) {
    alert("Add task error: " + err.message);
  }

  taskInput.value = "";
  taskDesc.value = "";
  taskDeadline.value = "";
});

// ---- Display Task ----
function displayTask(d) {
  const li = document.createElement("li");
  li.className = "task-item";
  li.id = d.id;
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

  // DELETE
  li.querySelector(".delete-btn").addEventListener("click", async () => {
    if (confirm("Delete this task?")) {
      if (d.id.startsWith("temp-")) li.remove();
      else await deleteDoc(doc(db, "tasks", d.id));
    }
  });

  // EDIT
  li.querySelector(".edit-btn").addEventListener("click", async () => {
    const newTitle = prompt("Update task title:", d.task);
    const newDesc = prompt("Update description:", d.description);
    const newDate = prompt("Update deadline (YYYY-MM-DD):", d.deadline);
    if (newTitle && newDate) {
      await updateDoc(doc(db, "tasks", d.id), {
        task: newTitle,
        description: newDesc,
        deadline: newDate,
        updatedAt: serverTimestamp()
      });
    }
  });

  taskList.prepend(li); // show at top immediately
}

// ---- Load Tasks (real-time sync) ----
function loadTasks(uid) {
  taskList.innerHTML = "";
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      displayTask({ id: docSnap.id, ...d });
    });
  }, (err) => {
    console.error("Error loading tasks:", err);
  });
}

// ---- Real-time Reminders ----
function startReminderChecker() {
  setInterval(() => {
    if (!auth.currentUser) return;
    const now = new Date();
    const taskItems = document.querySelectorAll(".task-item");

    taskItems.forEach(li => {
      const title = li.querySelector("strong").textContent;
      const deadlineText = li.querySelector("strong").nextSibling.textContent;
      const deadlineMatch = deadlineText.match(/\d{4}-\d{2}-\d{2}/);
      if (!deadlineMatch) return;
      const deadlineDate = new Date(deadlineMatch[0] + "T00:00:00");
      const diffHours = (deadlineDate - now) / (1000 * 60 * 60);

      if (diffHours <= 24 && diffHours > 0) {
        if (!li.dataset.notified) {
          if (Notification.permission === "granted") {
            new Notification("Reminder: " + title, { body: `Due ${deadlineMatch[0]}` });
          }
          li.dataset.notified = "true";
        }
      }
    });
  }, 60 * 1000);
}

// Request notification permission at the start
if (Notification.permission !== "granted") {
  Notification.requestPermission().then(() => startReminderChecker());
}
