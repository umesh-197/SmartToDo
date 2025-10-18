// Get elements
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
signupBtn.addEventListener("click", () => {
    auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
    .then(() => alert("Signup successful!"))
    .catch(err => alert(err.message));
});

// Login
loginBtn.addEventListener("click", () => {
    auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch(err => alert(err.message));
});

// Logout
logoutBtn.addEventListener("click", () => {
    auth.signOut();
});

// Auth state
auth.onAuthStateChanged(user => {
    if(user){
        authContainer.style.display = "none";
        todoContainer.style.display = "block";
        loadTasks();
    } else {
        authContainer.style.display = "block";
        todoContainer.style.display = "none";
    }
});

// Add task
addTaskBtn.addEventListener("click", () => {
    if(taskInput.value === "") return;
    db.collection("tasks").add({
        uid: auth.currentUser.uid,
        task: taskInput.value,
        deadline: taskDeadline.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    taskInput.value = "";
    taskDeadline.value = "";
});

// Load tasks
function loadTasks(){
    db.collection("tasks")
      .where("uid", "==", auth.currentUser.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
          taskList.innerHTML = "";
          snapshot.forEach(doc => {
              const li = document.createElement("li");
              const data = doc.data();
              li.textContent = `${data.task} (Deadline: ${data.deadline})`;
              taskList.appendChild(li);

              // Reminder notification
              if(data.deadline){
                  const deadlineDate = new Date(data.deadline);
                  const now = new Date();
                  if(deadlineDate - now <= 0){
                      new Notification("Task Deadline Passed!", { body: data.task });
                  }
              }
          });
      });
}
