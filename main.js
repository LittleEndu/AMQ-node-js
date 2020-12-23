const {app, BrowserWindow, Menu, MenuItem, dialog} = require('electron')
const windowStateKeeper = require('electron-window-state');
const versionCheck = require('github-version-checker');
const open = require('open')
const fs = require('fs');
const folderSize = require('get-folder-size');
const util = require('util')
const crypto = require('crypto')
const discordRPC = require('discord-rpc')

//main electron window
let win;
const versionText = `AMQ node.js by LittleEndu - ver:${app.getVersion()}`


//util functions
function toTitleCase(str) {
    // Todo: figure out this regex
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

//logging
if (!fs.existsSync(app.getPath('userData'))) {
    fs.mkdirSync(app.getPath('userData'));
}
const logFolder = app.getPath('userData') + '/logs'
if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
}
const logFile = app.getPath('userData') + '/logs/' + Date.now() + '.log'
fs.writeFileSync(logFile, "AMQ node.js log file\n")

while (folderSize(logFolder) > 2**20*50){
    let files = fs.readdirSync(logFolder)
    fs.unlinkSync(logFolder + files[0])
}


function logToFile(args) {
    fs.appendFile(logFile, args + "\n", function (err) {
        if (err) throw err;
    });
}

console.log = function (d) { //
    logToFile(util.format(d));
    process.stdout.write(util.format(d) + '\n');
};

// region Discord Rich Presence

const clientId = '635944292275453973';
discordRPC.register(clientId);
let isRpcConnected = false;
const rpc = new discordRPC.Client({transport: 'ipc'})
// https://discord.com/developers/applications/635944292275453973/rich-presence/assets

let currentView, gameMode, currentSongs, totalSongs, currentPlayers, totalPlayers, lobbyIsPrivate, isSpectator,
    songName, animeName, artistName, typeName, lobbyId, lobbyPassword, avatarName, outfitName, startTimestamp;

let gameModeKey = {
    "Standard": "standard",
    "Quick Draw": "quick_draw",
    "Last Man Standing": "lastman",
    "Battle Royale": "battle_royale",
    "Ranked": "logo"
};


async function discordActivity() {
    let details = "Not logged in";
    let largeImageKey = "logo"
    let largeImageText = versionText
    let instance = false;

    if (startTimestamp && currentView !== "Quiz") {
        startTimestamp = null
    }

    let state, smallImageKey, smallImageText, partyId, partySize, partyMax, joinSecret;

    let setPartyInfo = function () {
        smallImageKey = gameModeKey[gameMode]
        smallImageText = gameMode
        instance = true
        partyId = lobbyId.toString() + crypto.createHash('sha1').update(lobbyPassword).digest('base64')
        partySize = currentPlayers
        partyMax = totalPlayers
    }

    let setupSecret = function () {
        if (totalPlayers - currentPlayers > 0) {
            let base64password = Buffer.from(lobbyPassword).toString('base64')
            joinSecret = `${lobbyId}.${base64password}`
        }
    }


    if (currentView) {
        if (avatarName) {
            largeImageKey = `${avatarName}_${outfitName}`
                .replace(' ', '_')
                .toLowerCase()
            largeImageText = avatarName
        }
        switch (currentView) {
            default:
                details = `In ${currentView}`
                break;
            case "Room Browser":
                details = "Browsing rooms"
                break;
            case "Expand Library":
                details = "Expanding Library"
                if (songName) {
                    state = `Checking out '${songName}' by '${artistName}' from '${animeName}' [${typeName}]`
                }
                break;
            case "Lobby":
                details = (isSpectator ? "Waiting to Spectate" : "Waiting to Play") + (gameMode === "Ranked" ? " Ranked" : "")
                state = gameMode === "Ranked" ? "Ranked Lobby" : lobbyIsPrivate ? "Private Lobby" : "Public Lobby"
                setPartyInfo()
                setupSecret()
                break;
            case "Quiz":
                if (!startTimestamp) {
                    startTimestamp = Date.now()
                }
                details = (isSpectator ? "Spectating" : "Playing") + (gameMode === "Ranked" ? " Ranked" : "")
                state = `\uD83C\uDFBC ${currentSongs}/${totalSongs} \uD83D\uDC65`
                setPartyInfo()
                break;
        }
    }
    if (largeImageKey !== "logo" && !smallImageKey) {
        smallImageKey = "logo"
        smallImageText = versionText
    }

    // noinspection JSUnusedAssignment
    await rpc.setActivity({
        details,
        state,
        startTimestamp,
        largeImageKey,
        largeImageText,
        smallImageKey,
        smallImageText,
        instance,
        partyId,
        partySize,
        partyMax,
        joinSecret
    });
}

async function requestFromGame(toExecute) {
    if (win && win.webContents) {
        try {
            return await win.webContents.executeJavaScript(
                `try{${toExecute}}catch{}`
            )
        } catch (e) {
            console.log(
                `Error when getting "${toExecute}" from the game`
            )
            console.log(e)
        }
    }
}

async function discordGatherInfo() {
    if (isRpcConnected) {
        let _view = await requestFromGame("viewChanger.currentView")
        if (_view) {
            let getGameMode = async function () {
                let _scoreType = await requestFromGame("lobby.settings.scoreType")
                let _showSelection = await requestFromGame("lobby.settings.showSelection")
                if (await requestFromGame("lobby.settings.gameMode") === "Ranked") {
                    gameMode = "Ranked"
                    return;
                }
                if (await requestFromGame("quiz.gameMode") === "Ranked") {
                    gameMode = "Ranked"
                    return;
                }

                switch (_scoreType) {
                    case 1:
                        if (_showSelection === 1)
                            gameMode = "Standard"
                        break;
                    case 2:
                        if (_showSelection === 1)
                            gameMode = "Quick Draw"
                        break;
                    case 3:
                        switch (_showSelection) {
                            case 1:
                                gameMode = "Last Man Standing"
                                break;
                            case 2:
                                gameMode = "Battle Royale"
                                break;
                        }
                }
            }

            let getLobbySettings = async function () {
                lobbyIsPrivate = await requestFromGame("lobby.settings.privateRoom")
                let _solo = await requestFromGame("lobby.settings.gameMode")
                if (_solo === "Solo")
                    lobbyIsPrivate = true

                totalPlayers = await requestFromGame("lobby.settings.roomSize")
                if (gameMode === "Ranked")
                    totalPlayers = currentPlayers + 100 // game reports room size of 8
                lobbyId = await requestFromGame("lobby.gameId") || -1
                lobbyPassword = await requestFromGame("lobby.settings.password") || ''
            }


            // Todo: figure out this regex
            currentView = toTitleCase(_view.toString().replace(/([a-z])([A-Z])/g, '$1 $2'))
            avatarName = await requestFromGame("storeWindow.activeAvatar.avatarName")
            outfitName = await requestFromGame("storeWindow.activeAvatar.outfitName")
            switch (_view) {
                case "expandLibrary":
                    songName = await requestFromGame("expandLibrary.selectedSong.name")
                    artistName = await requestFromGame("expandLibrary.selectedSong.artist")
                    animeName = await requestFromGame("expandLibrary.selectedSong.animeName")
                    typeName = await requestFromGame("expandLibrary.selectedSong.typeName")
                    break;
                case "quiz":
                    await getGameMode()
                    currentSongs = await requestFromGame("quiz.infoContainer.$currentSongCount.text()")
                    totalSongs = await requestFromGame("quiz.infoContainer.$totalSongCount.text()")
                    isSpectator = await requestFromGame("quiz.isSpectator")
                    currentPlayers = await requestFromGame("Object.keys(quiz.players).length")
                    await getLobbySettings()
                    break;
                case "lobby":
                    await getGameMode()
                    isSpectator = await requestFromGame("lobby.isSpectator")
                    currentPlayers = await requestFromGame("Object.keys(lobby.players).length")
                    await getLobbySettings()
                    break;
            }
        } else {
            currentView = null;
        }

        await discordActivity().catch(console.log);

    } else {
        try {
            await rpc.login({clientId}); // this is safe to be called more than once
        } catch {}
    }
}

rpc.on('ready', () => {
    console.log(rpc.user)

    rpc.subscribe('ACTIVITY_JOIN', function (args) {
        if (!currentView) {
            return; // TODO: this should save the secret until we are logged into AMQ
        }
        let splitApart = args.secret.toString().split('.')
        let roomId = splitApart[0]
        if (roomId === '-1')
            roomId = null;
        let encodedPassword = splitApart[1]
        requestFromGame(
            `let decodedPassword = atob("${encodedPassword}"); roomBrowser.fireJoinLobby(${roomId}, decodedPassword)`
        ).catch(console.log)
    }).catch(console.log)

    rpc.subscribe('ACTIVITY_JOIN_REQUEST', (args) => {
        if (!lobbyIsPrivate) {
            rpc.sendJoinInvite(args['user']['id']).catch(console.log)
        }
    }).catch(console.log)
});

rpc.on('connected', () => {
    console.log("Connected to discord")
    isRpcConnected = true;
})

rpc.on('disconnected', () => {
    console.log("Disconnected from discord")
    isRpcConnected = false;
})


//set up for AMQ and other ux
function startup() {
    let winState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600
    });

    win = new BrowserWindow({
        x: winState.x,
        y: winState.y,
        width: winState.width,
        height: winState.height,
        icon: __dirname + '/favicon.png',
        title: "AMQ",
        show: false,
        backgroundColor: "#424242",
        webPreferences: {
            enableRemoteModule: false,
            contextIsolation: true
        }
    })
    win.onerror = (err) => {
        console.log(err)
    }
    winState.manage(win)
    const menu = new Menu();

    // region Hotkeys/MenuItem
    menu.append(new MenuItem({
        label: "Fullscreen",
        accelerator: "F11",
        click: () => {
            win.setFullScreen(!win.isFullScreen())
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Close",
        accelerator: "Alt+F4",
        click: () => {
            win.close()
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Zoom in",
        accelerator: "CommandOrControl+numadd",
        click: () => {
            win.webContents.setZoomFactor(win.webContents.getZoomFactor() + 0.1)
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Zoom out",
        accelerator: "CommandOrControl+numsub",
        click: () => {
            win.webContents.setZoomFactor(win.webContents.getZoomFactor() - 0.1)
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Reset zoom",
        accelerator: "CommandOrControl+num0",
        click: () => {
            win.webContents.setZoomFactor(1)
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Refresh",
        accelerator: "F5",
        click: () => {
            win.reload()
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Clear Cache",
        accelerator: "Shift+F5",
        click: () => {
            win.webContents.session.clearCache().then(() => {
                console.log("Cache cleared");
                win.reload();
            })
        },
        visible: false
    }))
    // menu.append(new MenuItem({
    //     label: "Debug",
    //     accelerator: "F12",
    //     click: () => {
    //         win.webContents.openDevTools()
    //     },
    //     visible: false
    // }))
    // endregion

    win.setMenu(menu)
    win.setMenuBarVisibility(false)
    win.loadURL("https://animemusicquiz.com/").then(() => {
        versionCheck({
            repo: 'amq-node-js',
            owner: 'LittleEndu',
            currentVersion: app.getVersion()
        }, null).then(function (update) {
            if (update) {
                let updateString = `An update is available!\nYou are on version ${app.getVersion()}\nLatest version is ${update.tag.name}`
                console.log(updateString);
                const response = dialog.showMessageBoxSync(win, {
                    type: 'question',
                    title: "Found an update!",
                    message: updateString,
                    buttons: ['Open github.com to update', 'Stay on this version'],
                    defaultId: 1,
                    cancelId: 1
                });
                if (response === 0) {
                    open(update.url)
                }
            } else {
                console.log("You are up to date.");
            }
        })
        setInterval(discordGatherInfo, 1_000);
    }).catch(console.log)


    // region Events
    win.on('closed', () => {
        win = null
    })
    win.on('ready-to-show', () => {
        win.show()
    })

    win.webContents.on('will-navigate', (_, url) => {
        console.log(
            `Navigating to ${url}`
        )
        win.webContents.insertCSS('html, body { background-color: #424242; }').catch(console.log)
    })

    win.webContents.on('new-window', (event, url) => {
        event.preventDefault()
        open(url)
    })

    win.webContents.on('will-prevent-unload', (event) => {
        const response = dialog.showMessageBoxSync(win, {
            type: 'question',
            title: 'Are you sure you want to leave?',
            message: "Leaving now might mean you can't come back.",
            buttons: ['Leave', 'Stay'],
            defaultId: 0,
            cancelId: 1
        });
        if (response === 0) {
            event.preventDefault()
        }
    })

    win.webContents.on('console-message', (event, level, message) => {
        console.log(message)
    })

    win.webContents.session.on('will-download', (event, item) => {
        event.preventDefault()
        open(item.getURL())
    })
    // endregion
}

app.on('ready', startup)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (win === null) {
        startup()
    }
})

