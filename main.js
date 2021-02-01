const {app, BrowserWindow, Menu, MenuItem, dialog} = require('electron')
const windowStateKeeper = require('electron-window-state');
const versionCheck = require('github-version-checker');
const open = require('open')
const fs = require('fs');
const folderSize = require('get-folder-size');
const util = require('util')
const crypto = require('crypto')
const {v4: uuidv4} = require('uuid');
const discordRPC = require('discord-rpc')

//main electron window
let win;
const versionText = `AMQ node.js by LittleEndu - ver:${app.getVersion()}`


//util functions
function toTitleCase(str) {
    // /\w\S*/g matches any not empty word
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

if (!fs.existsSync(app.getPath('userData'))) {
    fs.mkdirSync(app.getPath('userData'));
}
const logFolder = app.getPath('userData') + '/logs'
const scriptFolder = app.getPath('userData') + '/scripts'
const folders = [logFolder, scriptFolder]
folders.forEach((folder) => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
})

//logging
const logFile = app.getPath('userData') + '/logs/' + Date.now() + '.log'
fs.writeFileSync(logFile, "AMQ node.js log file\n")

while (
    folderSize(logFolder, (err, size) => {
        if (err)
            return false
        return size > 2 ** 20 * 50
    })
    ) {
    let files = fs.readdirSync(logFolder)
    fs.unlinkSync(`${logFolder}/${files[0]}`)
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


// user.js
function loadAllUserscripts() {
    if (win && win.webContents) {
        let files = fs.readdirSync(scriptFolder)
        files.sort()
        files.forEach((file) => {
            console.log(`Executing code from ${file}`)
            let codeToRun = fs.readFileSync(`${scriptFolder}/${file}`).toString()
            if (file.endsWith('.user.js')) {
                let uuid = "uuid_" + (uuidv4().toString().replaceAll(`-`, ''))
                codeToRun = `let ${uuid} = () => {${codeToRun}
                }; 
                try{${uuid}()}
                catch (err) {
                    console.log("Error when executing ${file}")
                    console.error(err)
                };`
            }
            try {
                win.webContents.executeJavaScript(codeToRun).catch(console.log)
            } catch (err) {
            }
        })
    }
}


// region Discord Rich Presence

const clientId = '635944292275453973';
discordRPC.register(clientId);

let isRpcConnected = false;
const rpc = new discordRPC.Client({transport: 'ipc'})
// https://discord.com/developers/applications/635944292275453973/rich-presence/assets

function clearDiscord() {
    // devsnek says you should make a new client for each connection, but that seems too confusing
    // this resets everything I use, except 'ready' and 'disconnected' listeners
    rpc._connectPromise = undefined;
    // noinspection JSAccessibilityCheck
    rpc._subscriptions = new Map();
    rpc.removeAllListeners('connected')
    // noinspection JSAccessibilityCheck
    rpc.transport.removeAllListeners('close')
}

let currentView, gameMode, currentSongs, totalSongs, currentPlayers, totalPlayers, lobbyIsPrivate, isSpectator,
    songName, animeName, artistName, typeName, lobbyId, lobbyPassword, avatarName, outfitName, startTimestamp;

async function discordActivity() {
    let details = "Not logged in";
    let largeImageKey = "logo"
    let largeImageText = versionText
    let instance = false;

    let state, smallImageKey, smallImageText, partyId, partySize, partyMax, joinSecret;

    let setPartyInfo = function () {
        instance = true
        if (totalPlayers === 1)
            return
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
            smallImageKey = "logo"
            smallImageText = versionText
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
                details = (isSpectator ? "Waiting to Spectate " : "Waiting to Play ") + (gameMode || "")
                state = gameMode === "Ranked" ? "Ranked Lobby" : lobbyIsPrivate ? "Private Lobby" : "Public Lobby"
                setPartyInfo()
                setupSecret()
                break;
            case "Battle Royal":
                details = (isSpectator ? "Watching looting phase" : "Looting songs")
                setPartyInfo()
                break;
            case "Quiz":
                if (!startTimestamp) {
                    startTimestamp = Date.now()
                }
                details = (isSpectator ? "Spectating " : "Playing ") + (gameMode || "")
                state = `\uD83C\uDFBC ${currentSongs}/${totalSongs} ` + (totalPlayers === 1 ? "" : "\uD83D\uDC65")
                setPartyInfo()
                break;
        }
    }

    // Check party size here, shouldn't be necessary
    if (partySize && partyMax) {
        if (partySize < 1 || partyMax < 1) {
            // noinspection JSUnusedAssignment
            console.log(`failed to set party size. partySize = ${partySize}, partyMax = ${partyMax}`)
            partySize = null
            partyMax = null
        }
    }

    if (startTimestamp && currentView !== "Quiz") {
        startTimestamp = null
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
                gameMode = null;
                if (await requestFromGame("hostModal.gameMode") === "Ranked") {
                    gameMode = "Ranked"
                    return;
                }

                let _scoreType = await requestFromGame("hostModal.$scoring.slider('getValue')")
                let _showSelection = await requestFromGame("hostModal.$showSelection.slider('getValue')")
                if (_showSelection === 2) {
                    gameMode = "Battle Royale"
                } else {
                    switch (_scoreType) {
                        case 1:
                            gameMode = "Standard"
                            break;
                        case 2:
                            gameMode = "Quick Draw"
                            break;
                        case 3:
                            gameMode = "Last Man Standing"
                            break;
                    }
                }
            }


            let getLobbySettings = async function (name = "lobby") {
                isSpectator = await requestFromGame(`${name}.isSpectator`)
                currentPlayers = await requestFromGame(`Object.keys(${name}.players).length`)

                // This is a thing only in lobby anyway
                // and since inviting can only happen in lobby then there should be no problem
                //   if our game ID is invalid at any other point
                lobbyId = await requestFromGame("lobby.gameId") || -1


                lobbyIsPrivate = await requestFromGame("hostModal.$privateCheckbox.prop('checked')")
                let _solo = await requestFromGame("hostModal.gameMode")
                if (_solo === "Solo") {
                    lobbyIsPrivate = true
                    totalPlayers = 1
                    lobbyPassword = ""
                    return
                }

                totalPlayers = await requestFromGame("hostModal.roomSizeSliderCombo.getValue()")
                if (gameMode === "Ranked")
                    totalPlayers = currentPlayers + 100 // game reports room size of 8
                if (!totalPlayers)
                    totalPlayers = currentPlayers

                lobbyPassword = await requestFromGame("hostModal.$passwordInput.val()")
            }


            // /([a-z])([A-Z])/g matches camelCase word changes, $1 $2 adds a space between the result
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
                case "lobby":
                    await getGameMode()
                    await getLobbySettings()
                    break;
                case "battleRoyal":
                    gameMode = "Battle Royale"
                    await getLobbySettings('battleRoyal')
                    break;
                case "quiz":
                    await getGameMode()
                    currentSongs = await requestFromGame("quiz.infoContainer.$currentSongCount.text()")
                    totalSongs = await requestFromGame("quiz.infoContainer.$totalSongCount.text()")
                    await getLobbySettings("quiz")
                    break;

            }
        } else {
            currentView = null;
        }

        await discordActivity().catch(console.log);

    } else {
        try {
            await rpc.login({clientId});
        } catch {
            clearDiscord()
        }
    }
}

rpc.on('ready', () => {
    console.log("Ready to discord")
    console.log(rpc.user)
    isRpcConnected = true;
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


rpc.on('disconnected', () => {
    isRpcConnected = false
    console.log("Disconnected from discord")
    clearDiscord()
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
    menu.append(new MenuItem({
        label: "Open Userdata Folder",
        accelerator: "CommandOrControl+Shift+U",
        click: () => {
            open(app.getPath('userData'))
        },
        visible: false
    }))
    menu.append(new MenuItem({
        label: "Debug",
        accelerator: "F12",
        click: () => {
            win.webContents.openDevTools()
        },
        visible: false
    }))
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

    win.webContents.on('did-finish-load', () => {
        loadAllUserscripts()
    })

    win.webContents.on('new-window', (event, url) => {
        event.preventDefault()
        console.log(`new-window: Opening ${url}`)
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

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(message)
        if (line && sourceId) {
            if (sourceId === win.webContents.getURL()) {
                console.log(`at line ${line} when executing an user script`)
            } else {
                console.log(`at line ${line} in ${sourceId}`)
            }
        }
    })

    win.webContents.session.on('will-download', (event, item) => {
        if (item.getURL().startsWith("blob:")) {
            console.log(`will-download: Saving ${item.getURL()} with filename ${item.getFilename()}`)
            item.once('done', (_, state) => {
                if (state === 'completed') {
                    console.log(`${item.getFilename()} downloaded successfully`)
                } else {
                    console.log(`${item.getFilename()} download failed: ${state}`)
                }
            })
        } else {
            event.preventDefault()
            console.log(`will-download: Opening ${item.getURL()}`)
            open(item.getURL())
        }
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

