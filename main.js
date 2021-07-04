const {app, BrowserWindow, Menu, MenuItem, dialog} = require('electron')

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0) // So no errors or flashing occurs
}

const windowStateKeeper = require('electron-window-state');
const versionCheck = require('github-version-checker');
const open = require('open')
const fs = require('fs');
const folderSize = require('get-folder-size');
const util = require('util')
const crypto = require('crypto')
const {v4: uuid_v4} = require('uuid');
const fuzz = require('fuzzball');
const discordRPC = require('discord-rpc')
const {discordAsker} = require('./discordAsker')

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

//create user data folder
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

function getLoggingFolderSize() {
    let rv = 0
    folderSize(logFolder, (err, size) => {
        if (err)
            rv = 0
        rv = size
    })
    return rv
}

while (getLoggingFolderSize() > 2 ** 20 * 50) {
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

console.log(`These arguments were used to start the app:\n${process.argv}`)


// user.js
let missingRequirements = []

function loadAllUserscripts() {
    missingRequirements = []
    if (win && win.webContents) {
        let files = fs.readdirSync(scriptFolder)
        files.forEach((file) => {
            if (!file.endsWith('.user.js')) {
                return;
            }
            console.log(`Executing code from ${file}`)
            let codeToRun = fs.readFileSync(`${scriptFolder}/${file}`).toString()
            let requirementsForTheCode = []

            // find the requirements
            // TODO: if this script requires another userscript, the parent will be loaded twice
            codeToRun.split('\n').forEach((line) => {
                if (line.startsWith('// @require')) {
                    let requirement = line.split('/').slice(-1)[0]
                    let maximumRatio = 0
                    let bestMatch = ""
                    files.forEach((f) => {
                        let ratio = fuzz.ratio(f, requirement)
                        if (ratio > maximumRatio) {
                            maximumRatio = ratio
                            bestMatch = f
                        }
                    })
                    if (maximumRatio < 95) {
                        console.log(`Missing requirement!!!\n${file} requires ${requirement} but nothing in your script folder matches the name`)
                        missingRequirements.push(`${requirement} required by ${file}`)
                    } else {
                        requirementsForTheCode.push(fs.readFileSync(`${scriptFolder}/${bestMatch}`).toString())
                    }
                }
            })

            // construct the function
            let uuid = "uuid_" + (uuid_v4().toString().replaceAll(`-`, ''))
            let requirementToRun = requirementsForTheCode.join('\n\n')
            codeToRun = `
let ${uuid} = () => {
${requirementToRun}
\n
${codeToRun}
}; 
try{${uuid}()}
catch (err) {
    console.log("Error when executing ${file}")
    console.error(err)
};`

            // run the function
            try {
                win.webContents.executeJavaScript(codeToRun).catch(err => {
                    throw err
                })
            } catch (err) {
            }
        })
    }
}


// region Discord Rich Presence

// https://discord.com/developers/applications/635944292275453973/rich-presence/assets
const clientId = '635944292275453973';
discordRPC.register(clientId);

let isRpcConnected = false;
let rpc = null


let currentView, gameMode, currentSongs, totalSongs, currentPlayers, totalPlayers, lobbyIsPrivate, isSpectator,
    songName, animeName, artistName, typeName, lobbyId, lobbyPassword, avatarName, outfitName, startTimestamp,
    details, largeImageKey, largeImageText, state, smallImageKey, smallImageText, partyId, partySize, partyMax,
    joinSecret, instance;

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

function setupPartyInfo() {
    if (totalPlayers === 1)
        return
    partyId = lobbyId.toString() + crypto.createHash('sha1').update(lobbyPassword).digest('base64')

    partySize = currentPlayers
    partyMax = totalPlayers
}

function setupSecret() {
    if (totalPlayers - currentPlayers > 0) {
        let base64password = Buffer.from(lobbyPassword).toString('base64')
        // TODO: allow people to join as spectator
        joinSecret = `${lobbyId}.${base64password}.${instance*1}`
    }
}

// noinspection OverlyComplexFunctionJS, because it's just a big switch statement
function setupCurrentViewInfo() {
    switch (currentView) {
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
            setupPartyInfo()
            setupSecret()
            break;
        case "Battle Royal":
            details = (isSpectator ? "Watching looting phase" : "Looting songs")
            setupPartyInfo()
            instance = true;
            setupSecret()
            break;
        case "Quiz":
            if (!startTimestamp) {
                startTimestamp = Date.now()
            }
            details = (isSpectator ? "Spectating " : "Playing ") + (gameMode || "")
            state = `\uD83C\uDFBC ${currentSongs}/${totalSongs} ` + (totalPlayers === 1 ? "" : "\uD83D\uDC65")
            setupPartyInfo()
            instance = true;
            setupSecret()
            break;
        default:
            details = `In ${currentView}`
            break;
    }
}

async function setDiscordActivity() {
    details = "Not logged in";
    state = undefined;
    largeImageKey = "logo";
    largeImageText = versionText;
    smallImageKey = undefined;
    smallImageText = undefined;
    instance = false; // From RPC SDK docs: (for future use) integer representing a boolean for if the player is in an instance (an in-progress match)
    partyId = undefined;
    partySize = undefined;
    partyMax = undefined;
    joinSecret = undefined;

    if (currentView) {
        if (avatarName) {
            largeImageKey = `${avatarName}_${outfitName}`.replace(' ', '_').toLowerCase()
            largeImageText = avatarName
            smallImageKey = "logo"
            smallImageText = versionText
        }
        setupCurrentViewInfo();
    }

    // Check party size here, shouldn't be necessary
    if (partySize && partyMax) {
        if (partySize < 1 || partyMax < 1) {
            console.log(`failed to set party size. partySize = ${partySize}, partyMax = ${partyMax}`)
            partySize = null
            partyMax = null
        }
    }

    // Reset startTimestamp if not in quiz
    if (startTimestamp && currentView !== "Quiz") {
        startTimestamp = null
    }

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


async function findInfoForActivity() {
    let _view = await requestFromGame("viewChanger.currentView")
    if (_view) {
        // /([a-z])([A-Z])/g matches camelCase word changes, $1 $2 adds a space between the result
        currentView = toTitleCase(_view.toString().replace(/([a-z])([A-Z])/g, '$1 $2'))
        avatarName = await requestFromGame("storeWindow.activeAvatar.avatarName")
        outfitName = await requestFromGame("storeWindow.activeAvatar.outfitName")

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
}

let useThisSecret = null

async function addDiscordFunctionsToGame() {
    if (win && win.webContents)
        await win.webContents.executeJavaScript(discordAsker.toString().match(/function[^{]+{([\s\S]*)}$/)[1])
}

async function manageInvites() {
    let invitedPeople = await requestFromGame('invitedPeople')
    if (!invitedPeople) {
        await addDiscordFunctionsToGame()
        return
    }
    let rejectedPeople = await requestFromGame('rejectedPeople')

    invitedPeople.forEach(person => {
        rpc.sendJoinInvite(person)
        requestFromGame(`inviteSent('${person}')`).then()
    })

    rejectedPeople.forEach(person => {
        rpc.closeJoinRequest(person)
        requestFromGame(`inviteSent('${person}')`).then()
    })
}

async function createNewDiscordClient() {
    rpc = new discordRPC.Client({transport: 'ipc'})
    rpc.on('ready', () => {
        console.log("Ready to discord")
        console.log(rpc.user)
        isRpcConnected = true;
        rpc.subscribe('ACTIVITY_JOIN').catch(console.log)
        rpc.subscribe('ACTIVITY_JOIN_REQUEST').catch(console.log)
    })

    rpc.on('ACTIVITY_JOIN', (args) => {
        useThisSecret = args.secret
    })

    rpc.on('ACTIVITY_JOIN_REQUEST', (args) => {
        if (!lobbyIsPrivate) {
            rpc.sendJoinInvite(args['user']['id']).catch(console.log)
        } else {
            let name = `${args['user']['username']}#${args['user']['discriminator']}`
            requestFromGame(
                `addDiscordInviteMessage('${name}', '${args['user']['id']}', '${args['user']['avatar']}')`
            )
        }
    })

    rpc.on('disconnected', () => {
        isRpcConnected = false
        console.log("Disconnected from discord")
        rpc = null
    })

    await rpc.login({clientId}).catch((err) => {
        rpc = null;
        throw err
    });
}


async function discordCallback() {
    if (rpc == null) {
        await createNewDiscordClient().catch();
    }
    if (isRpcConnected) {
        await findInfoForActivity().catch(console.log);
        await setDiscordActivity().catch(console.log);

        if (currentView && useThisSecret) {
            let splitApart = useThisSecret.toString().split('.')
            let roomId = splitApart[0]
            if (roomId === '-1')
                roomId = null;
            let encodedPassword = splitApart[1]
            let commandToUse = splitApart[2] === '0' ? 'fireJoinLobby' : 'fireSpectateGame'
            await requestFromGame(
                `let decodedPassword = atob("${encodedPassword}"); 
                roomBrowser.${commandToUse}(${roomId}, decodedPassword)`
            )
            useThisSecret = null
        }

        await manageInvites()
    }
}

// endregion

//set up for AMQ and other ux
function startup() {
    app.setAsDefaultProtocolClient('animemusicquiz')
    // TODO: see if discord has implemented using secret and buttons at the same time, then implement only-in-game invites

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
        setInterval(discordCallback, 1_000);
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
        if (missingRequirements.length !== 0) {
            dialog.showMessageBoxSync(win, {
                type: 'warning',
                title: 'Missing requirement detected',
                message: `The following scripts are required but can't be found:\n${missingRequirements.join(', ')}`
            })
        }
    })

    win.webContents.setWindowOpenHandler(details => {
        console.log(`setWindowOpenHandler: Opening ${details.url}`)
        open(details.url)
        return {action: 'deny'}
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

// noinspection JSCheckFunctionSignatures
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

app.on('second-instance', (event, argv, _) => {
    console.log(`Second instance called with:\n${argv}`)
    // TODO: implement only-in-game invites here
    if (win.isMinimized())
        win.restore()
    win.focus()
})

