const {app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, dialog} = require('electron');
const path = require('path');
const { exec } = require('child_process');
const prompt = require('electron-prompt');
const Store = require('electron-store');

let tray = null;
let active = true;

// Create a new store
const store = new Store();
// Use the interval from the store if it exists, otherwise use the default value
let interval = store.get('interval', 10);

let appIcon = nativeImage.createFromPath(path.join(__dirname, 'icons/icon.png'));
let activeIcon = nativeImage.createFromPath(path.join(__dirname, 'icons/active.png'));
let inactiveIcon = nativeImage.createFromPath(path.join(__dirname, 'icons/inactive.png'));

const musicNotRunningMessage = 'Please open Apple Music to activate Skimme.'
const noSong = 'Please play a song to activate Skimme.'

const isMusicRunningScript = `
osascript -e '
tell application "System Events"
    if exists (processes where name is "Music") then
        return "true"
    else
        return "false"
    end if
end tell
'`;


function isMusicPlaying(callback) {
    exec(isMusicRunningScript, (error, stdout, stderr) => {
        if (stdout.trim() === "true") {
            let script = `
            osascript -e '
            tell application "Music"
                if exists current track then
                    return "song selected"
                else
                    return "no song"
                end if
            end tell
            '`;
            exec(script, (error, stdout, stderr) => {
                if (stdout.trim() === "song selected") {
                    callback(true);
                } else {
                    dialog.showMessageBox({ message: noSong });
                    callback(false);
                }
            });
        } else {
            dialog.showMessageBox({ message: musicNotRunningMessage });
            callback(false);
        }
    });
}

function checkMusicStatus() {
    isMusicPlaying((isPlaying) => {
        active = isPlaying;
        // Update the tray icon and menu based on the new active status
        updateTrayIcon();
        updateTrayMenu();
    });
}



function updateTrayIcon() {
    tray.setImage(active ? activeIcon : inactiveIcon);
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Active',
            type: 'checkbox',
            checked: active,
            click: toggleActive,
        },
        {type: 'separator'},
        {
            label: 'Customize',
            click: customize,
        },
        {
            label: 'About',
            click: showAbout,
        },
        {type: 'separator'},
        {
            label: 'Quit',
            click: app.quit,
        },
    ]);

    tray.setContextMenu(contextMenu);
}



function toggleActive() {
    isMusicPlaying((isPlaying) => {
        if (isPlaying) {
            active = !active;
            // Update the tray icon and menu based on the new active status
            updateTrayIcon();
            updateTrayMenu();
            if (active) {
                registerShortcuts();  // function to register shortcuts
            } else {
                globalShortcut.unregisterAll();  // unregister all shortcuts when inactive
            }
        }
    });
}


async function customize() {
    const input = await prompt({
        title: 'Interval',
        label: 'Enter Interval (in seconds):',
        value: interval.toString(),
        inputAttrs: {
            type: 'number',
            min: 1,
            max: 300, // For example, set the maximum interval to 300 seconds
        },
    });

    if (input !== null) {
        let newInterval = parseInt(input, 10);

        // Add some additional checks before setting the interval
        if (newInterval < 1) {
            dialog.showMessageBox({ message: 'Interval must be at least 1 second.' });
            return;
        } else if (newInterval > 300) { // If the maximum interval is 300 seconds
            dialog.showMessageBox({ message: 'Interval cannot exceed 300 seconds.' });
            return;
        }

        interval = newInterval;

        // Save the interval to the store
        store.set('interval', interval);
    }
}

function showAbout() {
    //console.log('Show about');
    dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'About',
        message: 'Skimme — Hop through song sections in Apple Music using your keyboard.',
        detail: 'Simplify your journey to mastering songs with Skimme, a MacOS system tray app for Apple Music. Using your keyboard arrows, you can effortlessly rewind or advance the playhead during song playback.',
    });
}

function runAppleScript(script, callback) {
    exec(script, (error, stdout, stderr) => {
        if (error) {
            //console.log(`error: ${error.message}`);
            dialog.showMessageBox({ message: error.message });
            return;
        }
        if (stderr) {
            //console.log(`stderr: ${stderr}`);
            return;
        }
        if (stdout.trim() === "no song") {
            dialog.showMessageBox({ message: noSong });
            callback(false);
        } else {
            //console.log(`stdout: ${stdout}`);
            callback(true);
        }
    });
}


function registerShortcuts() {
    globalShortcut.register('Left', () => {
        // Check if a song is playing and the app is active
        checkMusicStatus();
        if (!active) return;

        //console.log('Left arrow pressed');
        let script = `
        osascript -e '
        tell application "Music"
            set playerPosition to player position
            if playerPosition > ${interval} then
                set player position to playerPosition - ${interval}
            else
                set player position to 0
            end if
        end tell
        '`;

        runAppleScript(script, () => {});
    });

    globalShortcut.register('Right', () => {
        // Check if a song is playing and the app is active
        checkMusicStatus();
        if (!active) return;

        //console.log('Right arrow pressed');
        let script = `
        osascript -e '
        tell application "Music"
            set playerPosition to player position
            set player position to playerPosition + ${interval}
        end tell
        '`;

        runAppleScript(script, () => {});
    });
}



app.whenReady().then(() => {
    // This block will run when the app is ready

    let icon = active ? activeIcon : inactiveIcon;
    tray = new Tray(icon);

    updateTrayMenu();

    // Check if Apple Music is open and a song is playing
    checkMusicStatus();

    if (active) {
        registerShortcuts();
    }
});



app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        
    }
});
