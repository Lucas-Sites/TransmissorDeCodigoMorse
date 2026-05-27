const socket = io('http://localhost:3001');

const mainMenu = document.getElementById('main-menu');
const joinForm = document.getElementById('join-form');
const roomScreen = document.getElementById('room-screen');
const nameForm = document.getElementById('name-form');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnBack = document.getElementById('btn-back');
const btnMorse = document.getElementById('btn-morse');
const btnLeave = document.getElementById('btn-leave');
const roomCodeInput = document.getElementById('room-code');
const roomCodeDisplay = document.getElementById('room-code-display');
const userNameInput = document.getElementById('user-name');
const usersUl = document.getElementById('users-ul');
const message = document.getElementById('message');

let currentRoom = null;
let audioCtx = null;
let oscillator = null;
let gainNode = null;

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function showMessage(msg) {
  message.textContent = msg;
  setTimeout(() => message.textContent = '', 3000);
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone() {
  initAudio();
  if (oscillator) return;
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
}

function stopTone() {
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
    gainNode = null;
  }
}

function renderUsers(users) {
  usersUl.innerHTML = '';
  users.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    usersUl.appendChild(li);
  });
}

function getUserName() {
  return userNameInput.value.trim() || 'Anônimo';
}

btnCreate.addEventListener('click', () => {
  socket.emit('create-room', getUserName());
});

btnJoin.addEventListener('click', () => {
  hide(mainMenu);
  hide(nameForm);
  show(joinForm);
  roomCodeInput.focus();
});

btnBack.addEventListener('click', () => {
  hide(joinForm);
  show(mainMenu);
  show(nameForm);
  roomCodeInput.value = '';
});

btnJoinRoom.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    showMessage('Digite um código de 6 caracteres');
    return;
  }
  socket.emit('join-room', code, getUserName());
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnJoinRoom.click();
});

function enterRoom(code) {
  currentRoom = code;
  hide(mainMenu);
  hide(joinForm);
  hide(nameForm);
  show(roomScreen);
  roomCodeDisplay.textContent = `Sala: ${code}`;
  roomCodeInput.value = '';
}

function leaveRoom() {
  currentRoom = null;
  stopTone();
  hide(roomScreen);
  hide(joinForm);
  show(mainMenu);
  show(nameForm);
  roomCodeDisplay.textContent = '';
  usersUl.innerHTML = '';
}

btnLeave.addEventListener('click', () => {
  socket.disconnect();
  socket.connect();
  leaveRoom();
});

btnMorse.addEventListener('mousedown', () => {
  if (!currentRoom) return;
  playTone();
  socket.emit('morse-signal', currentRoom);
});

btnMorse.addEventListener('mouseup', stopTone);
btnMorse.addEventListener('mouseleave', stopTone);

btnMorse.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!currentRoom) return;
  playTone();
  socket.emit('morse-signal', currentRoom);
});

btnMorse.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopTone();
});

socket.on('room-created', (code) => {
  enterRoom(code);
});

socket.on('joined-room', (code) => {
  enterRoom(code);
});

socket.on('error', (msg) => {
  showMessage(msg);
});

socket.on('morse-signal', () => {
  playTone();
  setTimeout(stopTone, 200);
});

socket.on('room-users', (users) => {
  renderUsers(users);
});

socket.on('user-joined', (name) => {
  showMessage(`${name} entrou na sala`);
});

socket.on('user-left', (name) => {
  showMessage(`${name} saiu da sala`);
});

socket.on('connect', () => {
  message.textContent = '';
});

socket.on('disconnect', () => {
  showMessage('Desconectado do servidor');
});
