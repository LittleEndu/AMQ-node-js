# AMQ-node-js
Local client for Anime Music Quiz that supports Discord rich presence

## Userscript support
Support for javascript scripting is really, really basic. 
Hit <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> and add the scripts to ``scripts`` folder. 
You need to manually manage any requirements these scripts might have. 
Scripts are loaded in alphabetical order, so you can just add numbers in front of them if you need to force loading order. 
Just watch out, ``2. foo.user.js`` will be loaded after ``10. bar.user.js``. 
Windows Explorer will actually show these files in "correct" order and not in alphabetical one. 
You want to use ``002. foo.user.js`` and ``010. bar.user.js`` when numbering scripts instead.

If you do find any script that doesn't work, and you can't fix it yourself 
then you can find me (LittleEndu#0001) on [AMQ discord](https://discord.gg/ZqTJeyV), you can DM me once you have joined.

## Will I get into trouble if I use this client?
This client is nothing more than an embedded web browser that also communicates with your local Discord client.
AMQ vise, it doesn't give you any advantages. No new functionality nor new features are added, and will never be added.

If you are instead concerned about this client being a virus, know that [it isn't.](https://www.virustotal.com/gui/file/5521600246dec761efb8cf9d67fe9cff58d6718a4e21fec9b9628223e1226a9c/detection)

## Download
Grab the latest release [from here](https://github.com/LittleEndu/AMQ-node-js/releases)

## Build instructions
I just ran ``electron-builder`` so YMMV
