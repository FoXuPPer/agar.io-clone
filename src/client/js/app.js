var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;

    playSpawnSound();
}

let soundEnabled = true;
const splitSound = document.getElementById('split_cell');
const spawnSound = document.getElementById('spawn_cell');

function playSplitSound() {
    if (soundEnabled) {
        splitSound.play().catch(error => console.log("Ошибка воспроизведения звука:", error));
    }
}

function playSpawnSound() {
    if (soundEnabled) {
        spawnSound.play().catch(error => console.log("Ошибка воспроизведения звука:", error));
    }
}

function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {
    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectator');
    };

    btn.onclick = function () {
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

// Джойстик
let joystickActive = false;
let joystickX = 0;
let joystickY = 0;
let joystickBaseX = 0;
let joystickBaseY = 0;
const joystickRadius = 50;
const maxDistance = 50;

// Отладка для проверки событий
c.addEventListener('mousedown', startJoystick);
c.addEventListener('touchstart', startJoystick);
c.addEventListener('mousemove', moveJoystick);
c.addEventListener('touchmove', moveJoystick);
c.addEventListener('mouseup', endJoystick);
c.addEventListener('touchend', endJoystick);

function startJoystick(event) {
    event.preventDefault();
    joystickActive = true;
    const touch = event.type === 'touchstart' ? event.touches[0] : event;
    joystickBaseX = touch.clientX;
    joystickBaseY = touch.clientY;
    joystickX = joystickBaseX;
    joystickY = joystickBaseY;
    console.log("Джойстик активирован:", joystickBaseX, joystickBaseY); // Отладка
}

function moveJoystick(event) {
    if (!joystickActive) return;
    event.preventDefault();
    const touch = event.type === 'touchmove' ? event.touches[0] : event;
    joystickX = touch.clientX;
    joystickY = touch.clientY;

    const dx = joystickX - joystickBaseX;
    const dy = joystickY - joystickBaseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDistance) {
        const angle = Math.atan2(dy, dx);
        joystickX = joystickBaseX + Math.cos(angle) * maxDistance;
        joystickY = joystickBaseY + Math.sin(angle) * maxDistance;
    }
    console.log("Джойстик движется:", dx, dy); // Отладка
}

function endJoystick() {
    joystickActive = false;
    joystickX = joystickBaseX;
    joystickY = joystickBaseY;
    console.log("Джойстик отключён"); // Отладка
}

function drawJoystick() {
    if (joystickActive) {
        graph.save();
        graph.beginPath();
        graph.arc(joystickBaseX, joystickBaseY, joystickRadius, 0, Math.PI * 2);
        graph.fillStyle = 'rgba(255, 255, 255, 0.2)';
        graph.fill();
        graph.closePath();

        graph.beginPath();
        graph.arc(joystickX, joystickY, joystickRadius / 2, 0, Math.PI * 2);
        graph.fillStyle = 'rgba(255, 255, 255, 0.5)';
        graph.fill();
        graph.closePath();
        graph.restore();
    }
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });

        let borders = {
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        };
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2
                });
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        // Обновление цели игрока с учётом джойстика
        if (joystickActive) {
            const dx = joystickX - joystickBaseX;
            const dy = joystickY - joystickBaseY;
            // Обновляем target на основе джойстика
            window.canvas.target.x = player.x + dx * 5; // Напрямую используем позицию игрока
            window.canvas.target.y = player.y + dy * 5;
        }

        // Отрисовка джойстика
        drawJoystick();

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
    playSplitSound(); 
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) {
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}

function setupSocket(socket) {
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    socket.on('RIP', function () {
        global.gameStart = false;
        render.drawErrorMessage('You died!', graph, global.screen);
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        } else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}
        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2
                });
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
