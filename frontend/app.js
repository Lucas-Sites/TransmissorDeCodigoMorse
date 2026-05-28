const WS_URL = 'wss://morsecodetransmitterbackend.onrender.com/';
let socket = null;
let reconnectInterval = null;
let currentRoom = null;
let audioCtx = null;
let oscillator = null;
let gainNode = null;

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
const messageEl = document.getElementById('message');

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function showMessage(msg) {
  messageEl.textContent = msg;
  setTimeout(() => messageEl.textContent = '', 3000);
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

function connect() {
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    messageEl.textContent = '';
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('Invalid message:', event.data);
    }
  };

  socket.onclose = () => {
    showMessage('Desconectado do servidor');
    clearInterval(reconnectInterval);
    reconnectInterval = setTimeout(connect, 3000);
  };

  socket.onerror = () => {
    showMessage('Erro de conexão');
  };
}

function send(msg) {
  console.log('[SEND]', msg, 'readyState:', socket ? socket.readyState : 'no socket');
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    console.warn('[SEND] WebSocket not open');
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'room-created':
      enterRoom(msg.code);
      break;
    case 'joined-room':
      enterRoom(msg.code);
      break;
    case 'error':
      showMessage(msg.message);
      break;
    case 'morse-signal':
      playTone();
      setTimeout(stopTone, 200);
      break;
    case 'room-users':
      renderUsers(msg.users);
      break;
    case 'user-joined':
      showMessage(`${msg.name} entrou na sala`);
      break;
    case 'user-left':
      showMessage(`${msg.name} saiu da sala`);
      break;
  }
}

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

btnCreate.addEventListener('click', () => {
  send({ type: 'create-room', name: getUserName() });
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
  send({ type: 'join-room', code, name: getUserName() });
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnJoinRoom.click();
});

btnLeave.addEventListener('click', () => {
  if (socket) {
    socket.close();
  }
  clearInterval(reconnectInterval);
  leaveRoom();
  connect();
});

let isTransmitting = false;

function startTransmit() {
  if (isTransmitting) return;
  if (!currentRoom) {
    showMessage('Entre em uma sala primeiro');
    return;
  }
  isTransmitting = true;
  btnMorse.classList.add('pressed');
  playTone();
  send({ type: 'morse-signal' });
}

function stopTransmit() {
  if (!isTransmitting) return;
  isTransmitting = false;
  btnMorse.classList.remove('pressed');
  stopTone();
}

btnMorse.addEventListener('mousedown', (e) => {
  e.preventDefault();
  startTransmit();
});

btnMorse.addEventListener('mouseup', (e) => {
  e.preventDefault();
  stopTransmit();
});

btnMorse.addEventListener('mouseleave', (e) => {
  if (isTransmitting) stopTransmit();
});

btnMorse.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startTransmit();
}, { passive: false });

btnMorse.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopTransmit();
}, { passive: false });

btnMorse.addEventListener('touchcancel', (e) => {
  e.preventDefault();
  stopTransmit();
}, { passive: false });

document.addEventListener('mouseup', () => {
  if (isTransmitting) stopTransmit();
});

document.addEventListener('touchend', () => {
  if (isTransmitting) stopTransmit();
});

connect();
