// script.js
import { auth, db, functions } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js";

/* DOM */
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
const taskTime = document.getElementById("task-time");
const addTaskBtn = document.getElementById("add-task-btn");
const taskList = document.getElementById("task-list");
const authMsg = document.getElementById("auth-msg");
const welcomeUser = document.getElementById("welcome-user");
const userContact = document.getElementById("user-contact");

const phoneNumberInput = document.getElementById("phone-number");
const sendOtpBtn = document.getElementById("send-otp-btn");
const otpInput = document.getElementById("otp");
const verifyOtpBtn = document.getElementById("verify-otp-btn");

const editModal = document.getElementById("edit-modal");
const editTitle = document.getElementById("edit-title");
const editDesc = document.getElementById("edit-desc");
const editDeadline = document.getElementById("edit-deadline");
const editTime = document.getElementById("edit-time");
const saveEditBtn = document.getElementById("save-edit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let currentUser = null;
let unsubscribeTasks = null;
let currentEditDocId = null;

/* Recaptcha (invisible) */
window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);

/* EMAIL SIGNUP */
signupBtn.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (!email || !pass) throw new Error("Enter email and password");
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, email, pass);
    authMsg.textContent = "Signup successful! (You can verify your email from Firebase Auth console or implement sendEmailVerification later.)";
  } catch (err) {
    authMsg.textContent = "Sign up error: " + err.message;
  }
});

/* EMAIL LOGIN */
loginBtn.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (!email || !pass) throw new Error("Enter email and password");
    authMsg.textContent = "Signing in...";
    await signInWithEmailAndPassword(auth, email, pass);
    authMsg.textContent = "Login successful!";
  } catch (err) {
    authMsg.textContent = "Sign in error: " + err.message;
  }
});

/* LOGOUT */
logoutBtn.addEventListener("click", async () => {
  if (unsubscribeTasks) unsubscribeTasks();
  await signOut(auth);
});

/* PHONE AUTH - SEND OTP */
sendOtpBtn.addEventListener("click", async () => {
  try {
    const phoneNumber = phoneNumberInput.value.trim();
    if (!phoneNumber) return alert("Enter phone number with country code");
    const appVerifier = window.recaptchaVerifier;
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    window.confirmationResult = confirmationResult;
    alert("OTP sent to your phone!");
  } catch (err) {
    alert("OTP error: " + err.message);
  }
});

/* PHONE AUTH - VERIFY OTP */
verifyOtpBtn.addEventListener("click", async () => {
  try {
    const otp = otpInput.value.trim();
    if (!otp) return alert("Enter OTP");
    await window.confirmationResult.confirm(otp);
    alert("Phone login successful!");
  } catch (err) {
    alert("Invalid OTP: " + err.message);
  }
});

/* AUTH STATE CHANGES */
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    authContainer.style.display = "none";
    todoContainer.style.display = "block";
    welcomeUser.textContent = `Hello, ${user.displayName || (user.email || user.phoneNumber)}`;
    userContact.textContent = user.email ? `Email: ${user.email}` : `Phone: ${user.phoneNumber}`;
    loadTasks(user.uid);
  } else {
    if (unsubscribeTasks) unsubscribeTasks();
    authContainer.style.display = "block";
    todoContainer.style.display = "none";
    taskList.innerHTML = "";
    welcomeUser.textContent = "Your Tasks";
    userContact.textContent = "";
  }
});

/* ADD TASK */
addTaskBtn.addEventListener("click", async () => {
  const title = taskInput.value.trim();
  const desc = taskDesc.value.trim();
  const date = taskDeadline.value;
  const time = taskTime.value || "00:00";
  if (!title || !date) return alert("Title and date required");
  if (!currentUser) return alert("Not signed in");

  // build deadline ISO (local)
  const deadlineISO = new Date(`${date}T${time}:00`).toISOString();

  try {
    const docRef = await addDoc(collection(db, "tasks"), {
      uid: currentUser.uid,
      task: title,
      description: desc,
      deadline: deadlineISO,
      createdAt: serverTimestamp(),
      reminderSent: false,
      contact: currentUser.email || currentUser.phoneNumber || null,
      authMethod: currentUser.phoneNumber ? "phone" : "email",
      emailVerified: !!currentUser.emailVerified
    });

    // clear inputs
    taskInput.value = "";
    taskDesc.value = "";
    taskDeadline.value = "";
    taskTime.value = "";

    // call immediate reminder function (it will only send if within 24h AND user verified/phone)
    try {
      const sendImmediateReminder = httpsCallable(functions, 'sendImmediateReminder');
      await sendImmediateReminder({ taskId: docRef.id });
    } catch (fnErr) {
      console.warn("Immediate reminder call failed:", fnErr);
    }

  } catch (err) {
    alert("Add task error: " + err.message);
  }
});

/* LOAD TASKS (REALTIME) */
function loadTasks(uid) {
  if (unsubscribeTasks) unsubscribeTasks();
  const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  unsubscribeTasks = onSnapshot(q, (snapshot) => {
    taskList.innerHTML = "";
    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const li = renderTaskItem(docSnap.id, d);
      taskList.appendChild(li);
    });
  }, err => {
    console.error("Tasks snapshot error:", err);
  });
}

/* RENDER TASK ITEM */
function renderTaskItem(id, d) {
  const li = document.createElement("li");
  li.className = "task-item" + (shouldHighlightReminder(d.deadline) ? " reminder" : "");
  const left = document.createElement("div");
  left.className = "task-left";
  const title = document.createElement("strong");
  title.textContent = d.task;
  const meta = document.createElement("div");
  meta.className = "task-meta";
  const dd = new Date(d.deadline);
  meta.textContent = `Due: ${dd.toLocaleDateString()} ${dd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  const desc = document.createElement("div");
  desc.textContent = d.description || "";

  left.appendChild(title);
  left.appendChild(desc);
  left.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.className = "small-btn edit";
  editBtn.addEventListener("click", () => openEditModal(id, d));

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.className = "small-btn delete";
  delBtn.addEventListener("click", async () => {
    if (confirm("Delete this task?")) {
      await deleteDoc(doc(db, "tasks", id));
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(left);
  li.appendChild(actions);

  return li;
}

/* highlight if due within 24h */
function shouldHighlightReminder(deadlineIso) {
  try {
    const dl = new Date(deadlineIso);
    const now = new Date();
    const diff = dl - now;
    return diff >= 0 && diff <= (24*60*60*1000);
  } catch { return false; }
}

/* EDIT MODAL */
function openEditModal(id, data) {
  currentEditDocId = id;
  editTitle.value = data.task || "";
  editDesc.value = data.description || "";
  const dd = new Date(data.deadline);
  editDeadline.value = dd.toISOString().slice(0,10);
  editTime.value = dd.toTimeString().slice(0,5);
  editModal.showModal();
}

saveEditBtn.addEventListener("click", async () => {
  if (!currentEditDocId) return;
  const title = editTitle.value.trim();
  const desc = editDesc.value.trim();
  const date = editDeadline.value;
  const time = editTime.value || "00:00";
  if (!title || !date) return alert("Title and date required");

  const deadlineISO = new Date(`${date}T${time}:00`).toISOString();

  await updateDoc(doc(db, "tasks", currentEditDocId), {
    task: title,
    description: desc,
    deadline: deadlineISO,
    reminderSent: false // reset so function may resend if needed
  });

  try {
    const sendImmediateReminder = httpsCallable(functions, 'sendImmediateReminder');
    await sendImmediateReminder({ taskId: currentEditDocId });
  } catch (e) {
    console.warn("Immediate reminder failed", e);
  }

  editModal.close();
  currentEditDocId = null;
});

cancelEditBtn.addEventListener("click", () => {
  editModal.close();
  currentEditDocId = null;
});

