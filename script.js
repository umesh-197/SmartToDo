// --- Firebase imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
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
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// --- DOM Elements ---
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

// --- Email/Password Auth ---
signupBtn.addEventListener("click", async () => {
  try {
    if (!emailInput.value || !passwordInput.value) throw new Error("Enter email and password");
    authMsg.textContent = "Signing up...";
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "Signup successful!";
  } catch (err) {
    authMsg.textContent = "Sign up error: " + err.message;
  }
});

loginBtn.addEventListener("click", async () => {
  try {
    if (!emailInput.value || !passwordInput.value) throw new Error("Enter email and password");
    authMsg.textContent = "Signing in...";
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authMsg.textContent = "Login successful!";
  } catch (err) {
    authMsg.textContent = "Sign in error: " + err.message;
  }
});

logoutBtn.addEventListener("click", async () => await signOut(auth));

// --- Phone Auth ---
window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" });

const phoneNumberInput = document.getElementById("phone-number");
const sendOtpBtn = document.getElementById("send-otp-btn");
const otpInput = document.getElementById("otp");
const verifyOtpBtn = document.getElementById("verify-otp-btn");

sendOtpBtn.addEventListener("click", async () => {
  try {
    const phoneNumber = phoneNumberInput.value;
    if (!phoneNumber) return alert("Enter phone number with country code");
    const appVerifier = window.recaptchaVerifier;
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    window.confirmationResult = confirmationResult;
    alert("OTP sent to your phone!");
  } catch (err) {
    alert("OTP error: " + err.message);
  }
});

verifyOtpBtn.addEventListener("click", async () => {
  try {
    const otp = otpInput.value;
    const result = await window.confirmationResult.confirm(otp);
    alert("Phone login successful!");
  } catch (err) {
    alert("Invalid OTP: " + err.message);
  }
});

// --- Auth State ---
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
  } catch (err) {
    alert("Add task error: " + err.message);
  }
});

// --- Load Tasks ---
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
        <em>${d.description}</em>
      `;
      taskList.appendChild(li);
    });
  });
}
