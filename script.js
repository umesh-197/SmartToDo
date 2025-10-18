// Elements
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
const taskList = document.getElementById("task-list");

// Sign up
signupBtn.addEventListener("click", async () => {
    try {
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        alert("Signup successful!");
    } catch (err) {
        alert(err.message);
    }
});

// Login
loginBtn.addEventListener("click", async () => {
    try {
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    } catch (err) {
        alert(err.message);
    }
});

// Logout
logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
});

// Auth state
onAuthStateChanged(auth, user => {
    if(user){
        authContainer.style.display = "none";
        todoContainer.style.display = "block";
        loadTasks(user.uid);
    } else {
        authContainer.style.display = "block";
        todoContainer.style.display = "none";
    }
});

// Add task
addTaskBtn.addEventListener("click", async () => {
    if(taskInput.value === "") return;
    await addDoc(collection(db, "tasks"), {
        uid: auth.currentUser.uid,
        task: taskInput.value,
        deadline: taskDeadline.value,
        createdAt: serverTimestamp()
    });
    taskInput.value = "";
    taskDeadline.value = "";
});

// Load tasks
function loadTasks(uid){
    const q = query(collection(db, "tasks"), where("uid", "==", uid), orderBy("createdAt", "desc"));
    onSnapshot(q, snapshot => {
        taskList.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement("li");
            li.textContent = `${data.task} (Deadline: ${data.deadline})`;
            taskList.appendChild(li);

            // Reminder notification
            if(data.deadline){
                const deadlineDate = new Date(data.deadline);
                const now = new Date();
                if(deadlineDate - now <= 0 && Notification.permission === "granted"){
                    new Notification("Task Deadline Passed!", { body: data.task });
                }
            }
        });
    });
}

// Ask permission for notifications
if(Notification.permission !== "granted") Notification.requestPermission();
