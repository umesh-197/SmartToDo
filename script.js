// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js";

// --- Firebase Config ---
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

// --- UI Elements ---
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

// --- Email Auth ---
signupBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !email.includes("@") || !email.includes(".")) {
    authMsg.textContent = "Invalid email format.";
    return;
  }
  if (password.length < 6) {
    authMsg.textContent = "Password must be at least 6 characters.";
    return;
  }

  try {
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, email, password);
    authMsg.textContent = "";
  } catch (err) {
    authMsg.textContent = "Sign up error: " + err.message;
  }
});

loginBtn.addEventListener("click", async () => {
  try {
    authMsg.textContent = "Signing in...";
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "";
  } catch (err) {
    authMsg.textContent = "Sign in error: " + err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// --- Phone Auth ---
let recaptchaVerifier;
let confirmationResult;

function setupRecaptcha() {
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
    callback: () => console.log("reCAPTCHA verified"),
  });
}
setupRecaptcha();

document.getElementById("send-otp-btn").addEventListener("click", async () => {
  const phoneNumber = document.getElementById("phone").value.trim();
  if (!phoneNumber.startsWith("+")) return alert("Please enter number like +919876543210");
  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    alert("OTP sent! Please check your phone.");
  } catch (error) {
    alert("Error sending OTP: " + error.message);
  }
});

document.getElementById("verify-otp-btn").addEventListener("click", async () => {
  const otp = document.getElementById("otp").value.trim();
  if (!otp) return alert("Please enter the OTP");
  try {
    const result = await confirmationResult.confirm(otp);
    alert("✅ Phone verified & signed in!");
    console.log(result.user);
  } catch {
    alert("❌ Incorrect OTP");
  }
});

// --- Auth State Change ---
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

    appendTaskToUI({ id: docRef.id, task: title, description: desc, deadline: date });
    taskInput.value = ""; taskDesc.value = ""; taskDeadline.value = "";
  } catch (err) {
    alert("Add task error: " + err.message);
  }
});

// --- Append Task to UI ---
function appendTaskToUI(d) {
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

  li.querySelector(".delete-btn").addEventListener("click", async () => {
    if (confirm("Delete this task?")) {
      await deleteDoc(doc(db, "tasks", d.id));
      li.remove();
    }
  });

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
      li.querySelector("strong").textContent = newTitle;
      li.querySelector("em").textContent = newDesc || "No description";
    }
  });

  taskList.prepend(li);
}

// --- Real-time Task Loading ---
function loadTasks(uid) {
  taskList.innerHTML = "";
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      d.id = docSnap.id;
      appendTaskToUI(d);
    });
  });
}
